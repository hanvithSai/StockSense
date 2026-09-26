import { can, manageCapability } from "@/lib/permissions";
import { operationFieldsSchema } from "@/lib/validation/operations";
import { forbidden } from "@/server/errors";
import { parseBody, route, todayParam } from "@/server/http";
import { deleteOperation, updateOperation } from "@/server/services/inventory";
import { getOperation, getOperationType } from "@/server/services/operation-queries";

export const GET = route({}, async ({ req, params }) => getOperation(params.id, todayParam(req)));

export const PATCH = route({}, async ({ req, params, user }) => {
  if (!can(user.role, manageCapability(await getOperationType(params.id)))) throw forbidden();
  await updateOperation(params.id, await parseBody(req, operationFieldsSchema), user);
  return getOperation(params.id, todayParam(req));
});

export const DELETE = route({}, async ({ params, user }) => {
  if (!can(user.role, manageCapability(await getOperationType(params.id)))) throw forbidden();
  await deleteOperation(params.id, user);
  return { ok: true };
});
