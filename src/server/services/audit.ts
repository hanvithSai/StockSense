import { Types, isValidObjectId, type ClientSession } from "mongoose";
import { AUDIT_ENTITIES, type AuditEntity } from "@/lib/constants";
import { escapeRegex, formatQty } from "@/lib/format";
import type { AuditLogDTO, Paginated, SessionUser } from "@/lib/types";
import { AuditLog, type AuditLogRecord } from "@/server/models/audit-log";

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

export async function getEntityActivity(entityType: AuditEntity, entityId: string, limit = 50): Promise<AuditLogDTO[]> {
  if (!isValidObjectId(entityId)) return [];
  const logs = await AuditLog.find({ entityType, entityId })
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
