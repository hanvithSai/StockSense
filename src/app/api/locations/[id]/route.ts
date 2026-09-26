import { locationSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteLocation, updateLocation } from "@/server/services/warehouses";

export const PATCH = route({ capability: "master:write" }, async ({ req, params }) => {
  await updateLocation(params.id, await parseBody(req, locationSchema));
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params }) => {
  await deleteLocation(params.id);
  return { ok: true };
});
