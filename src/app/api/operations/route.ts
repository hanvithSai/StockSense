import { can, manageCapability } from "@/lib/permissions";
import { operationCreateSchema } from "@/lib/validation/operations";
import { forbidden } from "@/server/errors";
import { operationFilters } from "@/server/filters";
import { pageParams, parseBody, route } from "@/server/http";
import { createOperation } from "@/server/services/inventory";
import { listOperations } from "@/server/services/operation-queries";

export const GET = route({}, async ({ req }) => listOperations(operationFilters(req), pageParams(req, 20)));

export const POST = route({}, async ({ req, user }) => {
  const input = await parseBody(req, operationCreateSchema);
  if (!can(user.role, manageCapability(input.type))) throw forbidden();
  return { id: await createOperation(input, user) };
});
