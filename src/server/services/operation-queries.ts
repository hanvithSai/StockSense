import { Types, isValidObjectId, type FilterQuery } from "mongoose";
import {
  OPEN_STATUSES,
  type OperationStatus,
  type OperationType,
} from "@/lib/constants";
import { escapeRegex } from "@/lib/format";
import type {
  OperationDTO,
  OperationListDTO,
  OperationListItemDTO,
} from "@/lib/types";
import { notFound } from "@/server/errors";
import { Operation, type OperationSchema } from "@/server/models/operation";
import type { OperationLean, PopulatedOperationLean } from "./records";

export interface OperationFilters {
  type?: OperationType;
  status?: OperationStatus[];
  warehouse?: string;
  location?: string;
  category?: string;
  product?: string;
  q?: string;
  late?: boolean;
  /** Only operations assigned to this user. */
  responsible?: string;
  /** Client's local date (`YYYY-MM-DD`) used for "late" / "upcoming" comparisons. */
  today: string;
  /** `schedule` lists the most urgent first; the default is newest first. */
  sort?: "recent" | "schedule";
  /** Scheduled date range (`YYYY-MM-DD`, inclusive), used by the calendar view. */
  scheduledFrom?: string;
  scheduledTo?: string;
}

const toId = (value?: string) => (value && isValidObjectId(value) ? new Types.ObjectId(value) : undefined);

export function isLate(op: { status: string; scheduledDate: string }, today: string): boolean {
  return OPEN_STATUSES.includes(op.status as OperationStatus) && op.scheduledDate < today;
}

/** Builds a Mongo filter shared by lists, the dashboard and move history (ids cast for aggregations). */
export function buildOperationMatch(
  filters: OperationFilters,
  options: { includeStatus?: boolean; includeSearch?: boolean } = {},
): FilterQuery<OperationSchema> {
  const { includeStatus = true, includeSearch = true } = options;
  const match: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (filters.type) match.type = filters.type;

  const warehouse = toId(filters.warehouse);
  if (warehouse) match.warehouse = warehouse;

  const location = toId(filters.location);
  if (location) and.push({ $or: [{ sourceLocation: location }, { destLocation: location }] });

  const category = toId(filters.category);
  if (category) match["lines.category"] = category;

  const product = toId(filters.product);
  if (product) match["lines.product"] = product;

  const responsible = toId(filters.responsible);
  if (responsible) match.responsible = responsible;

  if (includeSearch && filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    and.push({ $or: [{ reference: rx }, { contact: rx }, { "lines.productName": rx }, { "lines.sku": rx }] });
  }

  const scheduled: Record<string, string> = {};
  if (filters.scheduledFrom) scheduled.$gte = filters.scheduledFrom;
  if (filters.scheduledTo) scheduled.$lte = filters.scheduledTo;

  let statuses = includeStatus && filters.status?.length ? filters.status : undefined;
  if (filters.late) {
    statuses = (statuses ?? [...OPEN_STATUSES]).filter((status) => OPEN_STATUSES.includes(status));
    scheduled.$lt = filters.today;
  }
  if (statuses) match.status = { $in: statuses };
  if (Object.keys(scheduled).length) match.scheduledDate = scheduled;

  if (and.length) match.$and = and;
  return match as FilterQuery<OperationSchema>;
}

function productSummary(op: OperationLean): string {
  const names = op.lines.slice(0, 2).map((line) => line.productName);
  const extra = op.lines.length - names.length;
  return extra > 0 ? `${names.join(", ")} +${extra} more` : names.join(", ");
}

export function toListItem(op: OperationLean, today: string): OperationListItemDTO {
  return {
    id: op._id.toString(),
    reference: op.reference,
    type: op.type,
    status: op.status,
    contact: op.contact,
    sourceName: op.sourceName,
    destName: op.destName,
    scheduledDate: op.scheduledDate,
    responsibleName: op.responsibleName,
    lineCount: op.lines.length,
    productSummary: productSummary(op),
    isLate: isLate(op, today),
    doneAt: op.doneAt ? op.doneAt.toISOString() : null,
  };
}

export async function listOperations(
  filters: OperationFilters,
  paging: { page: number; limit: number; skip: number },
): Promise<OperationListDTO> {
  const match = buildOperationMatch(filters);
  const countMatch = buildOperationMatch(filters, { includeStatus: false });

  const [items, total, counts] = await Promise.all([
    Operation.find(match)
      .sort(filters.sort === "schedule" ? { scheduledDate: 1, createdAt: 1 } : { createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean<OperationLean[]>(),
    Operation.countDocuments(match),
    Operation.aggregate<{ _id: OperationStatus; count: number }>([
      { $match: countMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  return {
    items: items.map((op) => toListItem(op, filters.today)),
    total,
    page: paging.page,
    limit: paging.limit,
    statusCounts: Object.fromEntries(counts.map((row) => [row._id, row.count])),
  };
}

export function toOperationDTO(op: PopulatedOperationLean, today: string): OperationDTO {
  return {
    id: op._id.toString(),
    reference: op.reference,
    type: op.type,
    status: op.status,
    warehouse: {
      id: op.warehouse?._id.toString() ?? "",
      name: op.warehouse?.name ?? "Deleted warehouse",
      shortCode: op.warehouse?.shortCode ?? "",
    },
    sourceLocation: {
      id: op.sourceLocation?._id.toString() ?? "",
      fullName: op.sourceLocation?.fullName ?? op.sourceName,
      type: op.sourceLocation?.type ?? "internal",
    },
    destLocation: {
      id: op.destLocation?._id.toString() ?? "",
      fullName: op.destLocation?.fullName ?? op.destName,
      type: op.destLocation?.type ?? "internal",
    },
    contact: op.contact,
    deliveryAddress: op.deliveryAddress,
    scheduledDate: op.scheduledDate,
    responsible: op.responsible
      ? { id: op.responsible.toString(), name: op.responsibleName }
      : null,
    notes: op.notes,
    packed: op.packed,
    lines: op.lines.map((line) => ({
      id: line._id.toString(),
      productId: line.product.toString(),
      productName: line.productName,
      sku: line.sku,
      uom: line.uom,
      quantity: line.quantity,
      picked: line.picked,
      systemQty: line.systemQty ?? null,
      delta: line.delta ?? null,
    })),
    isLate: isLate(op, today),
    doneAt: op.doneAt ? op.doneAt.toISOString() : null,
    doneByName: op.doneByName || null,
    createdAt: op.createdAt.toISOString(),
    updatedAt: op.updatedAt.toISOString(),
  };
}

export async function getOperation(id: string, today: string): Promise<OperationDTO> {
  if (!isValidObjectId(id)) throw notFound("Operation");
  const op = await Operation.findById(id)
    .populate("warehouse", "name shortCode")
    .populate("sourceLocation", "fullName type")
    .populate("destLocation", "fullName type")
    .lean<PopulatedOperationLean>();
  if (!op) throw notFound("Operation");
  return toOperationDTO(op, today);
}

/** Work waiting for someone, per type: ready receipts/deliveries/transfers and draft counts. */
export async function getTodoCounts(): Promise<Record<OperationType, number>> {
  const rows = await Operation.aggregate<{ _id: OperationType; count: number }>([
    {
      $match: {
        $or: [
          { type: { $in: ["receipt", "delivery", "internal"] }, status: "ready" },
          { type: "adjustment", status: "draft" },
        ],
      },
    },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);
  const counts = { receipt: 0, delivery: 0, internal: 0, adjustment: 0 };
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

export async function getOperationType(id: string): Promise<OperationType> {
  const op = isValidObjectId(id)
    ? await Operation.findById(id).select("type").lean<{ type: OperationType }>()
    : null;
  if (!op) throw notFound("Operation");
  return op.type;
}

/** Distinct partner names for autocompletion. */
export async function listContacts(type?: OperationType): Promise<string[]> {
  const values: string[] = await Operation.distinct("contact", {
    ...(type ? { type } : {}),
    contact: { $ne: "" },
  });
  return values.sort((a, b) => a.localeCompare(b)).slice(0, 200);
}
