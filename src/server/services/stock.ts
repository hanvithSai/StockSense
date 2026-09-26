import { isValidObjectId, type Types } from "mongoose";
import type { StockStatus } from "@/lib/constants";
import { escapeRegex, round3 } from "@/lib/format";
import type { AvailabilityDTO, ProductOptionDTO, ProductRowDTO } from "@/lib/types";
import { Product } from "@/server/models/product";
import { ReorderRule } from "@/server/models/reorder-rule";
import { StockQuant } from "@/server/models/stock-quant";
import type { ProductLean, QuantLean } from "./records";

export interface StockScope {
  warehouse?: string;
  location?: string;
  category?: string;
  q?: string;
  productIds?: string[];
  includeArchived?: boolean;
}

interface RuleLean {
  product: Types.ObjectId;
  warehouse: Types.ObjectId;
  minQty: number;
  maxQty: number;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const sum = <T>(items: T[], value: (item: T) => number) =>
  round3(items.reduce((total, item) => total + value(item), 0));

/** Out of stock when nothing is on hand; low when any warehouse is at or below its reorder minimum. */
export function stockStatus(
  onHand: number,
  rules: { warehouse: Types.ObjectId; minQty: number }[],
  onHandByWarehouse: Map<string, number>,
): StockStatus {
  if (onHand <= 0) return "out";
  const low = rules.some((rule) => (onHandByWarehouse.get(rule.warehouse.toString()) ?? 0) <= rule.minQty);
  return low ? "low" : "ok";
}

function buildRow(product: ProductLean, quants: QuantLean[], rules: RuleLean[], scope: StockScope): ProductRowDTO {
  const inScope = quants.filter(
    (quant) =>
      (!scope.warehouse || quant.warehouse.toString() === scope.warehouse) &&
      (!scope.location || quant.location?._id.toString() === scope.location),
  );
  const onHand = sum(inScope, (quant) => quant.quantity);
  const reserved = sum(inScope, (quant) => quant.reservedQuantity);

  const onHandByWarehouse = new Map<string, number>();
  for (const quant of quants) {
    const key = quant.warehouse.toString();
    onHandByWarehouse.set(key, round3((onHandByWarehouse.get(key) ?? 0) + quant.quantity));
  }
  const scopedRules = rules.filter((rule) => !scope.warehouse || rule.warehouse.toString() === scope.warehouse);

  return {
    id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    uom: product.uom,
    costPrice: product.costPrice,
    description: product.description,
    category: product.category ? { id: product.category._id.toString(), name: product.category.name } : null,
    isActive: product.isActive,
    onHand,
    reserved,
    free: round3(onHand - reserved),
    value: Math.round(onHand * product.costPrice * 100) / 100,
    status: stockStatus(onHand, scopedRules, onHandByWarehouse),
    minQty: scopedRules.length ? sum(scopedRules, (rule) => rule.minQty) : null,
    maxQty: scopedRules.length ? sum(scopedRules, (rule) => rule.maxQty) : null,
    locations: inScope
      .filter((quant) => quant.quantity !== 0 || quant.reservedQuantity !== 0)
      .map((quant) => ({
        locationId: quant.location?._id.toString() ?? "",
        fullName: quant.location?.fullName ?? "Unknown location",
        warehouseId: quant.warehouse.toString(),
        quantity: quant.quantity,
        reserved: quant.reservedQuantity,
        free: round3(quant.quantity - quant.reservedQuantity),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
}

/** Per-product stock (on hand, reserved, free, value, status, per-location breakdown) for a scope. */
export async function getStockOverview(scope: StockScope = {}): Promise<ProductRowDTO[]> {
  const filter: Record<string, unknown> = {};
  if (!scope.includeArchived) filter.isActive = true;
  if (scope.category && isValidObjectId(scope.category)) filter.category = scope.category;
  if (scope.q) {
    const rx = new RegExp(escapeRegex(scope.q), "i");
    filter.$or = [{ name: rx }, { sku: rx }];
  }
  if (scope.productIds) filter._id = { $in: scope.productIds.filter((id) => isValidObjectId(id)) };

  const products = await Product.find(filter)
    .populate("category", "name")
    .sort({ name: 1 })
    .lean<ProductLean[]>();
  const ids = products.map((product) => product._id);

  const [quants, rules] = await Promise.all([
    StockQuant.find({ product: { $in: ids } }).populate("location", "fullName").lean<QuantLean[]>(),
    ReorderRule.find({ product: { $in: ids } }).lean<RuleLean[]>(),
  ]);
  const quantsByProduct = groupBy(quants, (quant) => quant.product.toString());
  const rulesByProduct = groupBy(rules, (rule) => rule.product.toString());

  return products.map((product) => {
    const id = product._id.toString();
    return buildRow(product, quantsByProduct.get(id) ?? [], rulesByProduct.get(id) ?? [], scope);
  });
}

/** On hand / reserved / free quantities of products at one location (live availability in forms). */
export async function getAvailability(location: string, productIds: string[]): Promise<AvailabilityDTO> {
  const ids = productIds.filter((id) => isValidObjectId(id));
  const result: AvailabilityDTO = Object.fromEntries(ids.map((id) => [id, { quantity: 0, reserved: 0, free: 0 }]));
  if (!isValidObjectId(location) || !ids.length) return result;

  const quants = await StockQuant.find({ location, product: { $in: ids } }).lean();
  for (const quant of quants) {
    result[quant.product.toString()] = {
      quantity: quant.quantity,
      reserved: quant.reservedQuantity,
      free: round3(quant.quantity - quant.reservedQuantity),
    };
  }
  return result;
}

/** Lightweight active product list for pickers. */
export async function getProductOptions(): Promise<ProductOptionDTO[]> {
  const [products, totals] = await Promise.all([
    Product.find({ isActive: true }).sort({ name: 1 }).select("name sku uom").lean<ProductLean[]>(),
    StockQuant.aggregate<{ _id: Types.ObjectId; onHand: number }>([
      { $group: { _id: "$product", onHand: { $sum: "$quantity" } } },
    ]),
  ]);
  const onHand = new Map(totals.map((row) => [row._id.toString(), round3(row.onHand)]));
  return products.map((product) => ({
    id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    uom: product.uom,
    onHand: onHand.get(product._id.toString()) ?? 0,
  }));
}
