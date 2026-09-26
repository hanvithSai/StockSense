import { Types, isValidObjectId } from "mongoose";
import { OPERATION_STATUSES, OPERATION_TYPES, type OperationStatus, type OperationType } from "@/lib/constants";
import { lastDays, round3 } from "@/lib/format";
import type { ReportDTO } from "@/lib/types";
import { Category } from "@/server/models/category";
import { Operation } from "@/server/models/operation";
import { Product } from "@/server/models/product";
import { Warehouse } from "@/server/models/warehouse";
import { getStockOverview } from "./stock";

export interface ReportFilters {
  days: number;
  warehouse?: string;
  today: string;
  timeZone: string;
}

interface DoneLine {
  opId: Types.ObjectId;
  type: OperationType;
  day: string;
  scheduledDate: string;
  doneAt: Date;
  createdAt: Date;
  product: Types.ObjectId;
  quantity: number;
  delta: number | null;
}

const money = (value: number) => Math.round(value * 100) / 100;

/** Analytics over validated operations in a period plus the current stock valuation. */
export async function getReport(filters: ReportFilters): Promise<ReportDTO> {
  const days = lastDays(filters.today, filters.days);
  const since = new Date(`${days[0]}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);
  const warehouseId = filters.warehouse && isValidObjectId(filters.warehouse) ? new Types.ObjectId(filters.warehouse) : undefined;
  const scope = warehouseId ? { warehouse: warehouseId } : {};

  const [lines, statusRows, stock, products, categories, warehouses] = await Promise.all([
    Operation.aggregate<DoneLine>([
      { $match: { ...scope, status: "done", doneAt: { $gte: since } } },
      { $unwind: "$lines" },
      {
        $project: {
          opId: "$_id",
          type: 1,
          scheduledDate: 1,
          doneAt: 1,
          createdAt: 1,
          product: "$lines.product",
          quantity: "$lines.quantity",
          delta: "$lines.delta",
          day: { $dateToString: { format: "%Y-%m-%d", date: "$doneAt", timezone: filters.timeZone } },
        },
      },
    ]),
    Operation.aggregate<{ _id: { type: OperationType; status: OperationStatus }; count: number }>([
      { $match: scope },
      { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } },
    ]),
    getStockOverview({ warehouse: filters.warehouse }),
    Product.find().select("name sku uom costPrice").lean<{ _id: Types.ObjectId; name: string; sku: string; uom: string; costPrice: number }[]>(),
    Category.find().select("name").lean<{ _id: Types.ObjectId; name: string }[]>(),
    Warehouse.find().select("name shortCode").lean<{ _id: Types.ObjectId; name: string; shortCode: string }[]>(),
  ]);

  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const inRange = lines.filter((line) => line.day >= days[0] && line.day <= days[days.length - 1]);
  const cost = (line: DoneLine) => productMap.get(line.product.toString())?.costPrice ?? 0;

  /* movement per day */
  const movement = new Map(days.map((date) => [date, { date, valueIn: 0, valueOut: 0, receipts: new Set<string>(), deliveries: new Set<string>() }]));
  const shipped = new Map<string, { quantity: number; value: number }>();
  let valueIn = 0;
  let valueOut = 0;
  let deliveredValue = 0;
  for (const line of inRange) {
    const point = movement.get(line.day)!;
    const unitCost = cost(line);
    if (line.type === "receipt") {
      point.valueIn += line.quantity * unitCost;
      point.receipts.add(line.opId.toString());
    } else if (line.type === "delivery") {
      point.valueOut += line.quantity * unitCost;
      point.deliveries.add(line.opId.toString());
      deliveredValue += line.quantity * unitCost;
      const key = line.product.toString();
      const current = shipped.get(key) ?? { quantity: 0, value: 0 };
      shipped.set(key, { quantity: round3(current.quantity + line.quantity), value: current.value + line.quantity * unitCost });
    } else if (line.type === "adjustment" && line.delta) {
      if (line.delta > 0) point.valueIn += line.delta * unitCost;
      else point.valueOut += -line.delta * unitCost;
    }
  }
  for (const point of movement.values()) {
    valueIn += point.valueIn;
    valueOut += point.valueOut;
  }

  /* service level */
  const operations = new Map<string, DoneLine>();
  for (const line of inRange) operations.set(line.opId.toString(), line);
  const planned = [...operations.values()].filter((op) => op.type !== "adjustment");
  const onTime = planned.filter((op) => op.day <= op.scheduledDate).length;
  const deliveries = planned.filter((op) => op.type === "delivery");
  const leadHours = deliveries.map((op) => (new Date(op.doneAt).getTime() - new Date(op.createdAt).getTime()) / 3_600_000);

  /* valuation */
  const stockValue = stock.reduce((total, row) => total + row.value, 0);
  const categoryNames = new Map(categories.map((category) => [category._id.toString(), category.name]));
  const byCategory = new Map<string, number>();
  for (const row of stock) {
    const name = row.category ? (categoryNames.get(row.category.id) ?? row.category.name) : "Uncategorised";
    byCategory.set(name, (byCategory.get(name) ?? 0) + row.value);
  }
  const byWarehouse = new Map<string, number>();
  for (const row of stock) {
    for (const location of row.locations) {
      byWarehouse.set(location.warehouseId, (byWarehouse.get(location.warehouseId) ?? 0) + location.quantity * row.costPrice);
    }
  }

  /* status by type (all time, in scope) */
  const statusByType = OPERATION_TYPES.map((type) => {
    const counts = Object.fromEntries(OPERATION_STATUSES.map((status) => [status, 0])) as Record<OperationStatus, number>;
    for (const row of statusRows) if (row._id.type === type) counts[row._id.status] = row.count;
    return { type, ...counts };
  });

  const periodDays = filters.days;
  return {
    days: periodDays,
    summary: {
      stockValue: money(stockValue),
      valueIn: money(valueIn),
      valueOut: money(valueOut),
      operationsDone: operations.size,
      onTimeRate: planned.length ? onTime / planned.length : null,
      avgDeliveryHours: leadHours.length ? leadHours.reduce((a, b) => a + b, 0) / leadHours.length : null,
      turnover: stockValue > 0 ? deliveredValue / stockValue : null,
      daysOfCover: deliveredValue > 0 ? stockValue / (deliveredValue / periodDays) : null,
    },
    movement: [...movement.values()].map((point) => ({
      date: point.date,
      valueIn: money(point.valueIn),
      valueOut: money(point.valueOut),
      receipts: point.receipts.size,
      deliveries: point.deliveries.size,
    })),
    valueByCategory: [...byCategory.entries()]
      .map(([name, value]) => ({ name, value: money(value) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value),
    valueByWarehouse: warehouses
      .map((warehouse) => ({ name: warehouse.name, code: warehouse.shortCode, value: money(byWarehouse.get(warehouse._id.toString()) ?? 0) }))
      .filter((item) => !warehouseId || item.value > 0)
      .sort((a, b) => b.value - a.value),
    topProducts: [...shipped.entries()]
      .map(([id, totals]) => {
        const product = productMap.get(id);
        return { id, name: product?.name ?? "Unknown", sku: product?.sku ?? "", uom: product?.uom ?? "", quantity: totals.quantity, value: money(totals.value) };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    statusByType,
    slowMovers: stock
      .filter((row) => row.onHand > 0 && !shipped.has(row.id))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((row) => ({ id: row.id, name: row.name, sku: row.sku, uom: row.uom, onHand: row.onHand, value: money(row.value) })),
  };
}
