import { OPERATION_TYPES, type OperationType } from "@/lib/constants";
import { route, searchParam } from "@/server/http";
import { listContacts } from "@/server/services/operation-queries";

export const GET = route({}, async ({ req }) => {
  const type = searchParam(req, "type") as OperationType | undefined;
  return listContacts(type && OPERATION_TYPES.includes(type) ? type : undefined);
});
