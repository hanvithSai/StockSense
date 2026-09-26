import { warehouseSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteWarehouse, updateWarehouse } from "@/server/services/warehouses";

export const PATCH = route({ capability: "master:write" }, async ({ req, params }) => {
  await updateWarehouse(params.id, await parseBody(req, warehouseSchema));
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params }) => {
  await deleteWarehouse(params.id);
  return { ok: true };
});
