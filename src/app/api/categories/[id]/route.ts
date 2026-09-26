import { categorySchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteCategory, updateCategory } from "@/server/services/catalog";

export const PATCH = route({ capability: "master:write" }, async ({ req, params, user }) => {
  await updateCategory(params.id, await parseBody(req, categorySchema), user);
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params, user }) => {
  await deleteCategory(params.id, user);
  return { ok: true };
});
