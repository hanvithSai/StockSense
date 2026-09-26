import { route, todayParam } from "@/server/http";
import { getProductForecast } from "@/server/services/stock";

/** Open receipts and deliveries of a product with the projected on-hand quantity after each. */
export const GET = route({}, async ({ req, params }) => getProductForecast(params.id, todayParam(req)));
