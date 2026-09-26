import { warehouseSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { createWarehouse, listWarehouses } from "@/server/services/warehouses";

export const GET = route({}, async () => listWarehouses());

export const POST = route({ capability: "master:write" }, async ({ req }) => ({
  id: await createWarehouse(await parseBody(req, warehouseSchema)),
}));
