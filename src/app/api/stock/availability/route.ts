import { listParam, route, searchParam } from "@/server/http";
import { getAvailability } from "@/server/services/stock";

export const GET = route({}, async ({ req }) =>
  getAvailability(searchParam(req, "location") ?? "", listParam(req, "products") ?? []),
);
