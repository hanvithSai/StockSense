import { route, todayParam } from "@/server/http";
import { getAlerts } from "@/server/services/dashboard";

export const GET = route({}, async ({ req }) => getAlerts(todayParam(req)));
