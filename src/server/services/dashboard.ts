import {
  OPEN_STATUSES,
  OPERATION_TYPES,
  type OperationStatus,
  type OperationType,
} from "@/lib/constants";
import { escapeRegex, round3 } from "@/lib/format";
import type {
  ActivityPointDTO,
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
  /** IANA time zone of the user, used to bucket activity by local day. */
  timeZone: string;
}

const ACTIVITY_DAYS = 14;

/** The `count` calendar days ending at `today` (inclusive), as `YYYY-MM-DD`. */
function lastDays(today: string, count: number): string[] {
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (count - 1 - index))).toISOString().slice(0, 10),
  );
}

async function getActivity(filters: DashboardFilters, match: Record<string, unknown>): Promise<ActivityPointDTO[]> {
  const days = lastDays(filters.today, ACTIVITY_DAYS);
  const since = new Date(`${days[0]}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);

  const rows = await Operation.aggregate<{ _id: { day: string; type: OperationType }; count: number }>([
    { $match: { ...match, status: "done", doneAt: { $gte: since } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$doneAt", timezone: filters.timeZone } },
          type: "$type",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const points = new Map(days.map((date) => [date, { date, receipt: 0, delivery: 0, internal: 0, adjustment: 0 }]));
  for (const row of rows) {
    const point = points.get(row._id.day);
    if (point) point[row._id.type] = row.count;
  }
  return [...points.values()];
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

  const [stock, facets, recent, activity] = await Promise.all([
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
    getActivity(filters, match),
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
    activity,
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
