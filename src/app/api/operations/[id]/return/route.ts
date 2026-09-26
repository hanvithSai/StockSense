import { returnSchema } from "@/lib/validation/operations";
import { parseBody, route } from "@/server/http";
import { createReturn } from "@/server/services/inventory";

/** POST /api/operations/:id/return: customer return (draft receipt) of a validated delivery. */
export const POST = route({ capability: "operation:plan" }, async ({ req, params, user }) => {
  const { lines } = await parseBody(req, returnSchema);
  return createReturn(params.id, lines, user);
});
