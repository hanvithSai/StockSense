import { route, searchParam } from "@/server/http";
import { search } from "@/server/services/dashboard";

export const GET = route({}, async ({ req }) => {
  const q = searchParam(req, "q")?.slice(0, 60);
  return q ? search(q) : { products: [], operations: [] };
});
