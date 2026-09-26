import { Types, isValidObjectId, type PipelineStage } from "mongoose";
import { escapeRegex, round3 } from "@/lib/format";
import type { LedgerRowDTO, MoveDirection, MoveRowDTO, Paginated } from "@/lib/types";
import { notFound } from "@/server/errors";
import { Operation } from "@/server/models/operation";
import { buildOperationMatch, type OperationFilters } from "./operation-queries";
import type { UnwoundLineLean } from "./records";

export interface MoveFilters extends OperationFilters {
  direction?: MoveDirection;
  doneOnly?: boolean;
}

const DIRECTION_MATCH: Record<MoveDirection, Record<string, unknown>> = {
  in: { $or: [{ type: "receipt" }, { type: "adjustment", "lines.delta": { $gt: 0 } }] },
  out: { $or: [{ type: "delivery" }, { type: "adjustment", "lines.delta": { $lt: 0 } }] },
  internal: { $or: [{ type: "internal" }, { type: "adjustment", "lines.delta": { $in: [0, null] } }] },
};

/** One move row per operation line: receipts are "in", deliveries "out", adjustments follow the delta. */
export function toMoveRow(doc: UnwoundLineLean): MoveRowDTO {
  const line = doc.lines;
  let direction: MoveDirection = "internal";
  let quantity = line.quantity;
  let from = doc.sourceName;
  let to = doc.destName;

  if (doc.type === "receipt") direction = "in";
  if (doc.type === "delivery") direction = "out";
  if (doc.type === "adjustment" && line.delta !== null && line.delta !== undefined && line.delta !== 0) {
    if (line.delta > 0) {
      direction = "in";
      quantity = line.delta;
    } else {
      direction = "out";
      quantity = -line.delta;
      from = doc.destName;
      to = doc.sourceName;
    }
  }

  return {
    id: `${doc._id.toString()}-${line._id.toString()}`,
    operationId: doc._id.toString(),
    reference: doc.reference,
    type: doc.type,
    status: doc.status,
    date: doc.doneAt ? new Date(doc.doneAt).toISOString() : doc.scheduledDate,
    contact: doc.contact,
    from,
    to,
    productId: line.product.toString(),
    productName: line.productName,
    sku: line.sku,
    uom: line.uom,
    quantity,
    direction,
  };
}

export async function listMoves(
  filters: MoveFilters,
  paging: { page: number; limit: number; skip: number },
): Promise<Paginated<MoveRowDTO>> {
  const match = buildOperationMatch(filters, { includeSearch: false });
  if (filters.doneOnly) match.status = "done";

  const lineMatch: Record<string, unknown>[] = [];
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    lineMatch.push({ $or: [{ reference: rx }, { contact: rx }, { "lines.productName": rx }, { "lines.sku": rx }] });
  }
  if (filters.product && isValidObjectId(filters.product)) {
    lineMatch.push({ "lines.product": new Types.ObjectId(filters.product) });
  }
  if (filters.category && isValidObjectId(filters.category)) {
    lineMatch.push({ "lines.category": new Types.ObjectId(filters.category) });
  }
  if (filters.direction) lineMatch.push(DIRECTION_MATCH[filters.direction]);

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $unwind: "$lines" },
    ...(lineMatch.length ? [{ $match: { $and: lineMatch } }] : []),
    {
      $addFields: {
        sortDate: { $ifNull: ["$doneAt", { $dateFromString: { dateString: "$scheduledDate" } }] },
      },
    },
    { $sort: { sortDate: -1, _id: -1 } },
    {
      $facet: {
        items: [{ $skip: paging.skip }, { $limit: paging.limit }],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Operation.aggregate<{ items: UnwoundLineLean[]; total: { count: number }[] }>(pipeline);
  return {
    items: (result?.items ?? []).map(toMoveRow),
    total: result?.total[0]?.count ?? 0,
    page: paging.page,
    limit: paging.limit,
  };
}

/** Stock ledger of a product: done moves with the resulting company-wide on-hand balance. */
export async function getProductLedger(productId: string, limit = 200): Promise<LedgerRowDTO[]> {
  if (!isValidObjectId(productId)) throw notFound("Product");
  const product = new Types.ObjectId(productId);
  const docs = await Operation.aggregate<UnwoundLineLean>([
    { $match: { status: "done", "lines.product": product } },
    { $unwind: "$lines" },
    { $match: { "lines.product": product } },
    { $sort: { doneAt: 1, _id: 1 } },
  ]);

  let balance = 0;
  const rows = docs.map((doc) => {
    const change =
      doc.type === "receipt"
        ? doc.lines.quantity
        : doc.type === "delivery"
          ? -doc.lines.quantity
          : doc.type === "adjustment"
            ? (doc.lines.delta ?? 0)
            : 0;
    balance = round3(balance + change);
    return { ...toMoveRow(doc), change: round3(change), balance };
  });
  return rows.reverse().slice(0, limit);
}
