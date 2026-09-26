import { categorySchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { createCategory, listCategories } from "@/server/services/catalog";

export const GET = route({}, async () => listCategories());

export const POST = route({ capability: "master:write" }, async ({ req, user }) => ({
  id: await createCategory(await parseBody(req, categorySchema), user),
}));
