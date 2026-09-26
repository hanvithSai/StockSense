import { route, searchParam, timeZoneParam, todayParam } from "@/server/http";
import { getDashboard } from "@/server/services/dashboard";

export const GET = route({}, async ({ req }) =>
  getDashboard({
    warehouse: searchParam(req, "warehouse"),
    location: searchParam(req, "location"),
    category: searchParam(req, "category"),
    today: todayParam(req),
    timeZone: timeZoneParam(req),
  }),
);
