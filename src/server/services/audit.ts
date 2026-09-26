import { Types, isValidObjectId, type ClientSession } from "mongoose";
import { AUDIT_ENTITIES, operationPath, type AuditEntity, type OperationType } from "@/lib/constants";
import { escapeRegex, formatQty } from "@/lib/format";
import type { AuditLogDTO, Paginated, SessionUser } from "@/lib/types";
import { notFound } from "@/server/errors";
import { AuditLog, type AuditLogRecord } from "@/server/models/audit-log";
import { Operation } from "@/server/models/operation";
import { Product } from "@/server/models/product";

export type AuditActor = Pick<SessionUser, "id" | "name"> | null;

export interface AuditEntry {
  entityType: AuditEntity;
  entityId?: Types.ObjectId | string | null;
  entityLabel: string;
  action: string;
  message: string;
  link?: string | null;
}

/** Appends entries to the audit trail (inside the caller's transaction when a session is given). */
export async function recordActivity(actor: AuditActor, entries: AuditEntry | AuditEntry[], session?: ClientSession) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (!list.length) return;
  await AuditLog.insertMany(
    list.map((entry) => ({
      entityType: entry.entityType,
      entityId: entry.entityId ? new Types.ObjectId(entry.entityId.toString()) : null,
      entityLabel: entry.entityLabel,
      action: entry.action,
      message: entry.message,
      link: entry.link ?? null,
      user: actor ? new Types.ObjectId(actor.id) : null,
      userName: actor?.name ?? "System",
    })),
    { session },
  );
}

/** "50 Units Desk, 40 Units Office Chair +2 more" */
export function summarizeLines(lines: { productName: string; quantity: number; uom: string }[], max = 3): string {
  const shown = lines.slice(0, max).map((line) => `${formatQty(line.quantity)} ${line.uom} ${line.productName}`);
  const extra = lines.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
}

function toDTO(log: AuditLogRecord): AuditLogDTO {
  return {
    id: log._id.toString(),
    entityType: log.entityType,
    entityId: log.entityId?.toString() ?? null,
    entityLabel: log.entityLabel,
    action: log.action,
    message: log.message,
    link: log.link ?? null,
    userId: log.user?.toString() ?? null,
    userName: log.userName,
    createdAt: log.createdAt.toISOString(),
  };
}

/** Adds a free-text note to a record's timeline (chatter-style "log note"). */
export async function logNote(actor: AuditActor, input: { entityType: "operation" | "product"; entityId: string; message: string }) {
  if (!isValidObjectId(input.entityId)) throw notFound("Record");
  const record =
    input.entityType === "operation"
      ? await Operation.findById(input.entityId).select("reference type").lean<{ reference: string; type: OperationType }>()
      : await Product.findById(input.entityId).select("name").lean<{ name: string }>();
  if (!record) throw notFound(input.entityType === "operation" ? "Operation" : "Product");
  const label = "reference" in record ? record.reference : record.name;
  const link = "reference" in record ? operationPath(record.type, input.entityId) : `/products/${input.entityId}`;
  await recordActivity(actor, { entityType: input.entityType, entityId: input.entityId, entityLabel: label, action: "note", message: input.message, link });
}

export async function getEntityActivity(entityType: AuditEntity, entityId: string, limit = 50): Promise<AuditLogDTO[]> {
  if (!isValidObjectId(entityId)) return [];
  const logs = await AuditLog.find({ entityType, entityId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean<AuditLogRecord[]>();
  return logs.map(toDTO);
}

/** Milestones worth showing in the team feed (pick, pack and field edits stay on each record's timeline). */
const FEED_ACTIONS = ["created", "ready", "waiting", "split", "returned", "validated", "cancelled", "reset", "note"];

/** Latest operation milestones and notes by anyone: the dashboard's team feed, visible to every role. */
export async function getTeamFeed(limit = 6): Promise<AuditLogDTO[]> {
  const logs = await AuditLog.find({ entityType: "operation", action: { $in: FEED_ACTIONS } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean<AuditLogRecord[]>();
  return logs.map(toDTO);
}

export interface ActivityFilters {
  entityType?: string;
  user?: string;
  q?: string;
}

export async function listActivity(
  filters: ActivityFilters,
  paging: { page: number; limit: number; skip: number },
): Promise<Paginated<AuditLogDTO>> {
  const match: Record<string, unknown> = {};
  if (filters.entityType && AUDIT_ENTITIES.includes(filters.entityType as AuditEntity)) match.entityType = filters.entityType;
  if (filters.user && isValidObjectId(filters.user)) match.user = new Types.ObjectId(filters.user);
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    match.$or = [{ message: rx }, { entityLabel: rx }, { userName: rx }];
  }
  const [logs, total] = await Promise.all([
    AuditLog.find(match).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit).lean<AuditLogRecord[]>(),
    AuditLog.countDocuments(match),
  ]);
  return { items: logs.map(toDTO), total, page: paging.page, limit: paging.limit };
}
