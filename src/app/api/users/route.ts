import { can } from "@/lib/permissions";
import { userCreateSchema } from "@/lib/validation/auth";
import { forbidden } from "@/server/errors";
import { parseBody, route, searchParam } from "@/server/http";
import { createUser, listUserOptions, listUsers } from "@/server/services/users";

/** `?options=1` returns active users for pickers (any role); the full list is manager-only. */
export const GET = route({}, async ({ req, user }) => {
  if (searchParam(req, "options")) return listUserOptions();
  if (!can(user.role, "users:manage")) throw forbidden();
  return listUsers();
});

/** Managers create accounts for colleagues with a temporary password. */
export const POST = route({ capability: "users:manage" }, async ({ req, user }) => ({
  id: await createUser(user, await parseBody(req, userCreateSchema)),
}));
