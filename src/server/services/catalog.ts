import { isValidObjectId, type Types } from "mongoose";
import type { StockStatus } from "@/lib/constants";
import { round3, todayISO } from "@/lib/format";
import { sortProducts, type ProductSort } from "@/lib/product-sort";
import type { CategoryDTO, Paginated, ProductRowDTO, ReorderRuleDTO } from "@/lib/types";
import {
  normalizeUom,
  productImportRowSchema,
  type CategoryInput,
  type ProductCreateInput,
  type ProductInput,
  type ReorderRuleInput,
} from "@/lib/validation/master";
import { withTransaction } from "@/server/db";
import { AppError, conflict, notFound, validationError } from "@/server/errors";
import { Category, type CategoryRecord } from "@/server/models/category";
import { Location, type LocationRecord } from "@/server/models/location";
import { Operation } from "@/server/models/operation";
import { Product } from "@/server/models/product";
import { ReorderRule } from "@/server/models/reorder-rule";
import { StockQuant } from "@/server/models/stock-quant";
import { Warehouse } from "@/server/models/warehouse";
import { recordActivity, type AuditActor } from "./audit";
import { createAppliedAdjustment, createOperation, type Actor } from "./inventory";
import { getPendingMoves, getStockOverview, stockStatus, type StockScope } from "./stock";

/* -------------------------------------------------------------- categories */

export async function listCategories(): Promise<CategoryDTO[]> {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean<CategoryRecord[]>(),
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);
  const byCategory = new Map(counts.map((row) => [row._id?.toString(), row.count]));
  return categories.map((category) => ({
    id: category._id.toString(),
    name: category.name,
    description: category.description ?? "",
    productCount: byCategory.get(category._id.toString()) ?? 0,
  }));
}

const categoryLog = (id: Types.ObjectId, name: string, action: string, message: string) => ({
  entityType: "category" as const,
  entityId: id,
  entityLabel: name,
  action,
  message,
  link: action === "deleted" ? null : "/products/categories",
});

export async function createCategory(input: CategoryInput, actor: AuditActor): Promise<string> {
  const category = await Category.create(input);
  await recordActivity(actor, categoryLog(category._id, category.name, "created", `Created category ${category.name}`));
  return category._id.toString();
}

export async function updateCategory(id: string, input: CategoryInput, actor: AuditActor): Promise<void> {
  const category = isValidObjectId(id) ? await Category.findByIdAndUpdate(id, input, { runValidators: true }) : null;
  if (!category) throw notFound("Category");
  await recordActivity(actor, categoryLog(category._id, input.name, "updated", `Updated category ${input.name}`));
}

export async function deleteCategory(id: string, actor: AuditActor): Promise<void> {
  if (!isValidObjectId(id)) throw notFound("Category");
  if (await Product.exists({ category: id })) {
    throw conflict("Move or delete the products of this category first");
  }
  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) throw notFound("Category");
  await recordActivity(actor, categoryLog(deleted._id, deleted.name, "deleted", `Deleted category ${deleted.name}`));
}

/* ---------------------------------------------------------------- products */

export interface ProductListOptions extends StockScope {
  stock?: StockStatus;
  archived?: boolean;
  sort?: ProductSort;
}

export async function listProducts(
  options: ProductListOptions,
  paging: { page: number; limit: number; skip: number },
): Promise<Paginated<ProductRowDTO>> {
  const rows = await getStockOverview({ ...options, includeArchived: options.archived });
  const matching = rows.filter(
    (row) => (!options.stock || row.status === options.stock) && (!options.archived || !row.isActive),
  );
  const filtered = options.sort ? sortProducts(matching, options.sort) : matching;
  return {
    items: filtered.slice(paging.skip, paging.skip + paging.limit),
    total: filtered.length,
    page: paging.page,
    limit: paging.limit,
  };
}

export async function getProduct(id: string): Promise<ProductRowDTO> {
  if (!isValidObjectId(id)) throw notFound("Product");
  const [row] = await getStockOverview({ productIds: [id], includeArchived: true });
  if (!row) throw notFound("Product");
  return row;
}

async function assertCategory(id: string) {
  if (!(await Category.exists({ _id: id }))) throw validationError({ category: "Select a valid category" });
}

const productLog = (id: Types.ObjectId, name: string, action: string, message: string) => ({
  entityType: "product" as const,
  entityId: id,
  entityLabel: name,
  action,
  message,
  link: `/products/${id.toString()}`,
});

/** Creates a product; the optional initial stock is booked as an inventory adjustment (ledger entry). */
export async function createProduct(input: ProductCreateInput, actor: Actor): Promise<string> {
  await assertCategory(input.category);
  const { initialQuantity, initialLocation, ...fields } = input;
  return withTransaction(async (session) => {
    const [product] = await Product.create([fields], { session });
    await recordActivity(actor, productLog(product._id, product.name, "created", `Created product ${product.name} (${product.sku})`), session);
    if (initialQuantity && initialQuantity > 0 && initialLocation) {
      await createAppliedAdjustment(session, {
        location: initialLocation,
        lines: [{ product: product._id.toString(), quantity: initialQuantity }],
        notes: "Initial stock",
        actor,
      });
    }
    return product._id.toString();
  });
}

export async function updateProduct(id: string, input: ProductInput, actor: AuditActor): Promise<void> {
  await assertCategory(input.category);
  const product = isValidObjectId(id) ? await Product.findById(id) : null;
  if (!product) throw notFound("Product");
  const costChanged = product.costPrice !== input.costPrice;
  product.set(input);
  await product.save();
  await recordActivity(
    actor,
    productLog(product._id, product.name, "updated", costChanged ? `Updated details, cost now ₹${input.costPrice}` : "Updated product details"),
  );
}

export async function setProductActive(id: string, isActive: boolean, actor: AuditActor): Promise<void> {
  const product = isValidObjectId(id) ? await Product.findById(id) : null;
  if (!product) throw notFound("Product");
  if (!isActive) {
    const [stock, open] = await Promise.all([
      StockQuant.exists({ product: product._id, quantity: { $gt: 0 } }),
      Operation.exists({ "lines.product": product._id, status: { $in: ["draft", "waiting", "ready"] } }),
    ]);
    if (stock) throw conflict("Products with stock on hand cannot be archived. Adjust the stock to 0 first");
    if (open) throw conflict("This product is used by open operations");
  }
  product.isActive = isActive;
  await product.save();
  await recordActivity(
    actor,
    productLog(product._id, product.name, isActive ? "restored" : "archived", isActive ? "Restored product" : "Archived product"),
  );
}

/* ------------------------------------------------------------ CSV import */

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; sku: string; message: string }[];
}

/**
 * Imports spreadsheet rows one by one, so a bad row never blocks the good ones.
 * Categories are matched by name (optionally created); initial stock is booked as an adjustment.
 */
export async function importProducts(
  input: { rows: Record<string, unknown>[]; updateExisting: boolean; createCategories: boolean },
  actor: Actor,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const [categories, locations, firstWarehouse] = await Promise.all([
    Category.find().lean<CategoryRecord[]>(),
    Location.find({ type: "internal" }).lean<LocationRecord[]>(),
    Warehouse.findOne().sort({ createdAt: 1 }).lean<{ defaultLocation: Types.ObjectId | null }>(),
  ]);
  const categoryByName = new Map(categories.map((category) => [category.name.toLowerCase(), category._id.toString()]));
  const locationByName = new Map(locations.map((location) => [location.fullName.toLowerCase(), location._id.toString()]));
  const defaultLocation = firstWarehouse?.defaultLocation?.toString();
  const seen = new Set<string>();

  for (const [index, raw] of input.rows.entries()) {
    const rowNumber = index + 2; // row 1 is the header
    const sku = String(raw.sku ?? "").trim().toUpperCase();
    const parsed = productImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      result.errors.push({ row: rowNumber, sku, message: parsed.error.issues[0].message });
      continue;
    }
    const row = parsed.data;
    if (seen.has(row.sku)) {
      result.errors.push({ row: rowNumber, sku: row.sku, message: "Duplicate SKU in the file" });
      continue;
    }
    seen.add(row.sku);

    try {
      let categoryId = categoryByName.get(row.category.toLowerCase());
      if (!categoryId) {
        if (!input.createCategories) {
          result.errors.push({ row: rowNumber, sku: row.sku, message: `Unknown category "${row.category}"` });
          continue;
        }
        categoryId = await createCategory({ name: row.category, description: "Created by CSV import" }, actor);
        categoryByName.set(row.category.toLowerCase(), categoryId);
      }
      const fields: ProductInput = {
        name: row.name,
        sku: row.sku,
        category: categoryId,
        uom: normalizeUom(row.uom)!,
        costPrice: row.costPrice,
        description: row.description,
      };

      const existing = await Product.findOne({ sku: row.sku }).select("_id").lean<{ _id: Types.ObjectId }>();
      if (existing) {
        if (!input.updateExisting) {
          result.skipped += 1;
          continue;
        }
        await updateProduct(existing._id.toString(), fields, actor);
        result.updated += 1;
        continue;
      }

      let initialLocation: string | undefined;
      if (row.initialQuantity && row.initialQuantity > 0) {
        initialLocation = row.location ? locationByName.get(row.location.toLowerCase()) : defaultLocation;
        if (!initialLocation) {
          result.errors.push({ row: rowNumber, sku: row.sku, message: `Unknown location "${row.location}"` });
          continue;
        }
      }
      await createProduct({ ...fields, initialQuantity: row.initialQuantity, initialLocation }, actor);
      result.created += 1;
    } catch (error) {
      const message = error instanceof AppError ? (Object.values(error.fields ?? {})[0] ?? error.message) : "Could not import this row";
      result.errors.push({ row: rowNumber, sku: row.sku, message });
    }
  }

  await recordActivity(actor, {
    entityType: "product",
    entityLabel: "CSV import",
    action: "imported",
    message: `Imported products from CSV: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} with errors`,
    link: "/products",
  });
  return result;
}

/* ----------------------------------------------------------- reorder rules */

interface RuleWithRefs {
  _id: Types.ObjectId;
  product: { _id: Types.ObjectId; name: string; sku: string; uom: ReorderRuleDTO["product"]["uom"] } | null;
  warehouse: { _id: Types.ObjectId; name: string; shortCode: string } | null;
  minQty: number;
  maxQty: number;
}

/**
 * Rules with live status. Alerts use stock on hand; the suggested order quantity uses the
 * forecast (on hand + open receipts - open deliveries), so stock already on order is not ordered twice.
 */
export async function listReorderRules(): Promise<ReorderRuleDTO[]> {
  const rules = await ReorderRule.find()
    .populate("product", "name sku uom")
    .populate("warehouse", "name shortCode")
    .lean<RuleWithRefs[]>();
  const productIds = rules.flatMap((rule) => (rule.product ? [rule.product._id] : []));
  const [totals, pending] = await Promise.all([
    StockQuant.aggregate<{ _id: { product: Types.ObjectId; warehouse: Types.ObjectId }; onHand: number }>([
      { $group: { _id: { product: "$product", warehouse: "$warehouse" }, onHand: { $sum: "$quantity" } } },
    ]),
    getPendingMoves(productIds),
  ]);
  const key = (product: Types.ObjectId, warehouse: Types.ObjectId) => `${product.toString()}:${warehouse.toString()}`;
  const onHandMap = new Map(totals.map((row) => [key(row._id.product, row._id.warehouse), round3(row.onHand)]));
  const netPending = new Map<string, number>();
  for (const move of pending) {
    const id = key(move.product, move.warehouse);
    netPending.set(id, round3((netPending.get(id) ?? 0) + (move.type === "receipt" ? move.quantity : -move.quantity)));
  }

  return rules
    .filter((rule) => rule.product && rule.warehouse)
    .map((rule) => {
      const product = rule.product!;
      const warehouse = rule.warehouse!;
      const onHand = onHandMap.get(key(product._id, warehouse._id)) ?? 0;
      const forecast = round3(onHand + (netPending.get(key(product._id, warehouse._id)) ?? 0));
      const status = stockStatus(
        onHand,
        [{ warehouse: warehouse._id, minQty: rule.minQty }],
        new Map([[warehouse._id.toString(), onHand]]),
      );
      return {
        id: rule._id.toString(),
        product: { id: product._id.toString(), name: product.name, sku: product.sku, uom: product.uom },
        warehouse: { id: warehouse._id.toString(), name: warehouse.name, shortCode: warehouse.shortCode },
        minQty: rule.minQty,
        maxQty: rule.maxQty,
        onHand,
        forecast,
        status,
        suggestedQty: forecast <= rule.minQty ? Math.max(0, round3(rule.maxQty - forecast)) : 0,
      };
    })
    .sort((a, b) => a.product.name.localeCompare(b.product.name));
}

/**
 * Creates one draft receipt per warehouse for every product at or below its minimum,
 * ordering enough to refill to the maximum. Returns the new references.
 */
export async function replenishLowStock(actor: Actor): Promise<string[]> {
  const due = (await listReorderRules()).filter((rule) => rule.suggestedQty > 0);
  if (!due.length) return [];
  const active = new Set(
    (await Product.find({ _id: { $in: due.map((rule) => rule.product.id) }, isActive: true }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map(
      (product) => product._id.toString(),
    ),
  );
  const byWarehouse = new Map<string, ReorderRuleDTO[]>();
  for (const rule of due.filter((item) => active.has(item.product.id))) {
    byWarehouse.set(rule.warehouse.id, [...(byWarehouse.get(rule.warehouse.id) ?? []), rule]);
  }
  const warehouses = await Warehouse.find({ _id: { $in: [...byWarehouse.keys()] } }).lean<
    { _id: Types.ObjectId; defaultLocation: Types.ObjectId | null }[]
  >();

  const ids: string[] = [];
  for (const warehouse of warehouses) {
    const rules = byWarehouse.get(warehouse._id.toString()) ?? [];
    if (!warehouse.defaultLocation || !rules.length) continue;
    ids.push(
      await createOperation(
        {
          type: "receipt",
          sourceLocation: "",
          destLocation: warehouse.defaultLocation.toString(),
          contact: "Replenishment order",
          deliveryAddress: "",
          scheduledDate: todayISO(),
          responsible: actor.id,
          notes: `Generated from reordering rules: ${rules.length} product${rules.length === 1 ? "" : "s"} at or below minimum. Assign the vendor before confirming.`,
          lines: rules.slice(0, 100).map((rule) => ({ product: rule.product.id, quantity: rule.suggestedQty })),
        },
        actor,
      ),
    );
  }
  const created = await Operation.find({ _id: { $in: ids } }).select("reference").lean<{ reference: string }[]>();
  return created.map((op) => op.reference);
}

/** Validates the rule's references and returns a readable label, e.g. "Desk · WH". */
async function ruleLabel(input: ReorderRuleInput): Promise<string> {
  const [product, warehouse] = await Promise.all([
    Product.findById(input.product).select("name").lean<{ name: string }>(),
    Warehouse.findById(input.warehouse).select("shortCode").lean<{ shortCode: string }>(),
  ]);
  const errors: Record<string, string> = {};
  if (!product) errors.product = "Select a valid product";
  if (!warehouse) errors.warehouse = "Select a valid warehouse";
  if (Object.keys(errors).length) throw validationError(errors);
  return `${product!.name} · ${warehouse!.shortCode}`;
}

const ruleLog = (id: Types.ObjectId, label: string, action: string, message: string) => ({
  entityType: "reorderRule" as const,
  entityId: id,
  entityLabel: label,
  action,
  message,
  link: action === "deleted" ? null : "/products/reordering",
});

export async function createReorderRule(input: ReorderRuleInput, actor: AuditActor): Promise<string> {
  const label = await ruleLabel(input);
  if (await ReorderRule.exists({ product: input.product, warehouse: input.warehouse })) {
    throw validationError({ product: "A rule for this product and warehouse already exists" });
  }
  const rule = await ReorderRule.create(input);
  await recordActivity(actor, ruleLog(rule._id, label, "created", `Created reordering rule: min ${input.minQty}, max ${input.maxQty}`));
  return rule._id.toString();
}

export async function updateReorderRule(id: string, input: ReorderRuleInput, actor: AuditActor): Promise<void> {
  const label = await ruleLabel(input);
  const rule = isValidObjectId(id) ? await ReorderRule.findById(id) : null;
  if (!rule) throw notFound("Reordering rule");
  const duplicate = await ReorderRule.exists({
    _id: { $ne: rule._id },
    product: input.product,
    warehouse: input.warehouse,
  });
  if (duplicate) throw validationError({ product: "A rule for this product and warehouse already exists" });
  rule.set(input);
  await rule.save();
  await recordActivity(actor, ruleLog(rule._id, label, "updated", `Updated reordering rule: min ${input.minQty}, max ${input.maxQty}`));
}

export async function deleteReorderRule(id: string, actor: AuditActor): Promise<void> {
  const deleted = isValidObjectId(id) ? await ReorderRule.findByIdAndDelete(id) : null;
  if (!deleted) throw notFound("Reordering rule");
  await recordActivity(actor, ruleLog(deleted._id, "Reordering rule", "deleted", "Deleted reordering rule"));
}
