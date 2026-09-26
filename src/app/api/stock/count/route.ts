import { z } from "zod";
import { objectId } from "@/lib/validation/common";
import { parseBody, route } from "@/server/http";
import { startLocationCount } from "@/server/services/inventory";

const countSchema = z.object({ location: objectId("Select a location") });

/** Starts a full physical count of a location (draft adjustment with every stored product). */
export const POST = route({ capability: "stock:move" }, async ({ req, user }) => {
  const { location } = await parseBody(req, countSchema);
  return { id: await startLocationCount(location, user) };
});
