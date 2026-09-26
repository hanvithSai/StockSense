import { categorySchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteCategory, updateCategory } from "@/server/services/catalog";

export const PATCH = route({ capability: "master:write" }, async ({ req, params }) => {
  await updateCategory(params.id, await parseBody(req, categorySchema));
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params }) => {
  await deleteCategory(params.id);
  return { ok: true };
});
