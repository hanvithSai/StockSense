import { userUpdateSchema } from "@/lib/validation/auth";
import { parseBody, route } from "@/server/http";
import { updateUser } from "@/server/services/users";

export const PATCH = route({ capability: "users:manage" }, async ({ req, params, user }) => {
  await updateUser(user, params.id, await parseBody(req, userUpdateSchema));
  return { ok: true };
});
