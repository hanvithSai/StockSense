import { AUDIT_ENTITIES, type AuditEntity } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { forbidden } from "@/server/errors";
import { pageParams, route, searchParam } from "@/server/http";
import { getEntityActivity, listActivity } from "@/server/services/audit";

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
