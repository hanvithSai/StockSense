import { z } from "zod";
import { productSchema } from "@/lib/validation/master";
import { optionalBody, route } from "@/server/http";
import { getProduct, setProductActive, updateProduct } from "@/server/services/catalog";

const activeSchema = z.object({ isActive: z.boolean() }).strict();

export const GET = route({}, async ({ params }) => getProduct(params.id));

/** Full update, or `{ isActive }` to archive / restore. */
export const PATCH = route({ capability: "master:write" }, async ({ req, params, user }) => {
  const body = await optionalBody(req);
  const toggle = activeSchema.safeParse(body);
  if (toggle.success) await setProductActive(params.id, toggle.data.isActive, user);
  else await updateProduct(params.id, productSchema.parse(body), user);
  return getProduct(params.id);
});

export const DELETE = route({ capability: "master:write" }, async ({ params, user }) => {
  await setProductActive(params.id, false, user);
  return { ok: true };
});
