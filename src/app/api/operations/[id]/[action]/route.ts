import { actionCapability, can } from "@/lib/permissions";
import type { OperationActionResult } from "@/lib/types";
import { OPERATION_ACTIONS, type OperationAction } from "@/lib/validation/operations";
import { forbidden, notFound } from "@/server/errors";
import { optionalBody, route, todayParam } from "@/server/http";
import { runOperationAction } from "@/server/services/inventory";
import { getOperation, getOperationType } from "@/server/services/operation-queries";

/** POST /api/operations/:id/{confirm|check-availability|pick|pack|validate|cancel|reset} */
export const POST = route({}, async ({ req, params, user }): Promise<OperationActionResult> => {
  const action = params.action as OperationAction;
  if (!OPERATION_ACTIONS.includes(action)) throw notFound("Action");

  const type = await getOperationType(params.id);
  if (!can(user.role, actionCapability(type, action))) throw forbidden();

  const outcome = await runOperationAction(params.id, action, await optionalBody(req), user);
  return { operation: await getOperation(params.id, todayParam(req)), ...outcome };
});
