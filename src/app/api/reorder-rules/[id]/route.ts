import { reorderRuleSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { deleteReorderRule, updateReorderRule } from "@/server/services/catalog";

export const PATCH = route({ capability: "master:write" }, async ({ req, params }) => {
  await updateReorderRule(params.id, await parseBody(req, reorderRuleSchema));
  return { ok: true };
});

export const DELETE = route({ capability: "master:write" }, async ({ params }) => {
  await deleteReorderRule(params.id);
  return { ok: true };
});
