import { warehouseSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteWarehouse, updateWarehouse } from "@/server/services/warehouses";

export const PATCH = route({ capability: "master:write" }, async ({ req, params, user }) => {
  await updateWarehouse(params.id, await parseBody(req, warehouseSchema), user);
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params, user }) => {
  await deleteWarehouse(params.id, user);
  return { ok: true };
});
