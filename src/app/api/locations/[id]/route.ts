import { locationSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteLocation, updateLocation } from "@/server/services/warehouses";

export const PATCH = route({ capability: "master:write" }, async ({ req, params, user }) => {
  await updateLocation(params.id, await parseBody(req, locationSchema), user);
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params, user }) => {
  await deleteLocation(params.id, user);
  return { ok: true };
});
