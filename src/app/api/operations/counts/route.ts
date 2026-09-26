import { route } from "@/server/http";
import { getTodoCounts } from "@/server/services/operation-queries";

export const GET = route({}, async () => getTodoCounts());
