import { reorderRuleSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteReorderRule, updateReorderRule } from "@/server/services/catalog";

export const PATCH = route({ capability: "master:write" }, async ({ req, params, user }) => {
  await updateReorderRule(params.id, await parseBody(req, reorderRuleSchema), user);
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params, user }) => {
  await deleteReorderRule(params.id, user);
  return { ok: true };
});
