import {
  OPEN_STATUSES,
  OPERATION_TYPES,
  type OperationStatus,
  type OperationType,
} from "@/lib/constants";
import { escapeRegex, round3 } from "@/lib/format";
import type {
  AlertsDTO,
  DashboardDTO,
  OperationTypeStats,
  ProductRowDTO,
  SearchResultsDTO,
} from "@/lib/types";
import { Operation } from "@/server/models/operation";
import { listMoves } from "./moves";
import { buildOperationMatch } from "./operation-queries";
import type { OperationLean } from "./records";
import { getStockOverview } from "./stock";

export interface DashboardFilters {
  warehouse?: string;
  location?: string;
  category?: string;
  today: string;
}

const emptyStats = (): OperationTypeStats => ({
  draft: 0,
  waiting: 0,
  ready: 0,
  done: 0,
  cancelled: 0,
  open: 0,
  late: 0,
  upcoming: 0,
});

function byUrgency(a: ProductRowDTO, b: ProductRowDTO) {
  if (a.status !== b.status) return a.status === "out" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export async function getDashboard(filters: DashboardFilters): Promise<DashboardDTO> {
  const match = buildOperationMatch({ ...filters });

  const [stock, facets, recent] = await Promise.all([
    getStockOverview({ warehouse: filters.warehouse, location: filters.location, category: filters.category }),
    Operation.aggregate<{
      byStatus: { _id: { type: OperationType; status: OperationStatus }; count: number }[];
      late: { _id: OperationType; count: number }[];
      upcoming: { _id: OperationType; count: number }[];
    }>([
      { $match: match },
      {
        $facet: {
          byStatus: [{ $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } }],
          late: [
            { $match: { status: { $in: OPEN_STATUSES }, scheduledDate: { $lt: filters.today } } },
            { $group: { _id: "$type", count: { $sum: 1 } } },
          ],
          upcoming: [
            { $match: { status: { $in: OPEN_STATUSES }, scheduledDate: { $gt: filters.today } } },
            { $group: { _id: "$type", count: { $sum: 1 } } },
          ],
        },
      },
    ]),
    listMoves({ ...filters, doneOnly: true }, { page: 1, limit: 6, skip: 0 }),
  ]);

  const operations = Object.fromEntries(OPERATION_TYPES.map((type) => [type, emptyStats()])) as Record<
    OperationType,
    OperationTypeStats
  >;
  const [facet] = facets;
  for (const row of facet?.byStatus ?? []) operations[row._id.type][row._id.status] = row.count;
  for (const row of facet?.late ?? []) operations[row._id].late = row.count;
  for (const row of facet?.upcoming ?? []) operations[row._id].upcoming = row.count;
  for (const stats of Object.values(operations)) stats.open = stats.draft + stats.waiting + stats.ready;

  return {
    kpis: {
      productsInStock: stock.filter((row) => row.onHand > 0).length,
      totalProducts: stock.length,
      lowStock: stock.filter((row) => row.status === "low").length,
      outOfStock: stock.filter((row) => row.status === "out").length,
      pendingReceipts: operations.receipt.open,
      pendingDeliveries: operations.delivery.open,
      scheduledTransfers: operations.internal.open,
      stockValue: round3(stock.reduce((total, row) => total + row.value, 0)),
    },
    operations,
    alerts: stock.filter((row) => row.status !== "ok").sort(byUrgency).slice(0, 6),
    recentMoves: recent.items,
  };
}

export async function getAlerts(today: string): Promise<AlertsDTO> {
  const [stock, waitingCount, lateCount] = await Promise.all([
    getStockOverview(),
    Operation.countDocuments({ status: "waiting" }),
    Operation.countDocuments({ status: { $in: OPEN_STATUSES }, scheduledDate: { $lt: today } }),
  ]);
  const flagged = stock.filter((row) => row.status !== "ok").sort(byUrgency);
  return {
    items: flagged.slice(0, 20).map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      uom: row.uom,
      onHand: row.onHand,
      minQty: row.minQty,
      status: row.status,
    })),
    lowCount: flagged.filter((row) => row.status === "low").length,
    outCount: flagged.filter((row) => row.status === "out").length,
    waitingCount,
    lateCount,
  };
}

export async function search(query: string): Promise<SearchResultsDTO> {
  const rx = new RegExp(escapeRegex(query), "i");
  const [products, operations] = await Promise.all([
    getStockOverview({ q: query }),
    Operation.find({ $or: [{ reference: rx }, { contact: rx }] })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean<OperationLean[]>(),
  ]);
  return {
    products: products.slice(0, 6).map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      onHand: row.onHand,
      uom: row.uom,
    })),
    operations: operations.map((op) => ({
      id: op._id.toString(),
      reference: op.reference,
      type: op.type,
      status: op.status,
      contact: op.contact,
    })),
  };
}
