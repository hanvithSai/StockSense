import { reorderRuleSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { createReorderRule, listReorderRules } from "@/server/services/catalog";

export const GET = route({}, async () => listReorderRules());

export const POST = route({ capability: "master:write" }, async ({ req, user }) => ({
  id: await createReorderRule(await parseBody(req, reorderRuleSchema), user),
}));
