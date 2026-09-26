import { route, searchParam, timeZoneParam, todayParam } from "@/server/http";
import { getReport } from "@/server/services/reports";

const PERIODS = [7, 30, 90];

export const GET = route({}, async ({ req }) => {
  const days = Number(searchParam(req, "days"));
  return getReport({
    days: PERIODS.includes(days) ? days : 30,
    warehouse: searchParam(req, "warehouse"),
    today: todayParam(req),
    timeZone: timeZoneParam(req),
  });
});
