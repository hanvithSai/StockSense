import { route } from "@/server/http";
import { getProductLedger } from "@/server/services/moves";

export const GET = route({}, async ({ params }) => getProductLedger(params.id));
