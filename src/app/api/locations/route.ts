import { locationSchema } from "@/lib/validation/master";
import { parseBody, route, searchParam } from "@/server/http";
import { createLocation, listLocations } from "@/server/services/warehouses";

export const GET = route({}, async ({ req }) =>
  listLocations({
    warehouse: searchParam(req, "warehouse"),
    includeSystem: searchParam(req, "includeSystem") === "1",
  }),
);

export const POST = route({ capability: "master:write" }, async ({ req }) => ({
  id: await createLocation(await parseBody(req, locationSchema)),
}));
