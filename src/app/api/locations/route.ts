import { locationSchema } from "@/lib/validation/master";
import { parseBody, route, searchParam } from "@/server/http";
import { createLocation, listLocations, listLocationStats } from "@/server/services/warehouses";

/** `?stats=1` adds the products held and stock value per location (settings page). */
export const GET = route({}, async ({ req }) => {
  const warehouse = searchParam(req, "warehouse");
  if (searchParam(req, "stats") === "1") return listLocationStats({ warehouse });
  return listLocations({ warehouse, includeSystem: searchParam(req, "includeSystem") === "1" });
});

export const POST = route({ capability: "master:write" }, async ({ req, user }) => ({
  id: await createLocation(await parseBody(req, locationSchema), user),
}));
