import { z } from "zod";
import { AUDIT_ENTITIES, type AuditEntity } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { objectId } from "@/lib/validation/common";
import { forbidden } from "@/server/errors";
import { pageParams, parseBody, route, searchParam } from "@/server/http";
import { getEntityActivity, listActivity, logNote } from "@/server/services/audit";

const noteSchema = z.object({
  entityType: z.enum(["operation", "product"], { error: "Notes can be added to operations and products" }),
  entityId: objectId("Invalid record"),
  message: z.string().trim().min(1, "Write a note first").max(1000, "Notes are limited to 1000 characters"),
});

/**
 * `?entityType=operation&entityId=…` returns the timeline of one record (any role).
 * Without `entityId`, the full audit trail is returned (managers only).
 */
export const GET = route({}, async ({ req, user }) => {
  const entityType = searchParam(req, "entityType") as AuditEntity | undefined;
  const entityId = searchParam(req, "entityId");
  if (entityId && entityType && AUDIT_ENTITIES.includes(entityType)) {
    return getEntityActivity(entityType, entityId);
  }
  if (!can(user.role, "users:manage")) throw forbidden();
  return listActivity(
    { entityType, user: searchParam(req, "user"), q: searchParam(req, "q") },
    pageParams(req, 30),
  );
});

/** Log a note on a record's timeline (any signed-in user). */
export const POST = route({}, async ({ req, user }) => {
  await logNote(user, await parseBody(req, noteSchema));
  return { ok: true };
});
