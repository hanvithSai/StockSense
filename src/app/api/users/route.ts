import { can } from "@/lib/permissions";
import { forbidden } from "@/server/errors";
import { route, searchParam } from "@/server/http";
import { listUserOptions, listUsers } from "@/server/services/users";

/** `?options=1` returns active users for pickers (any role); the full list is manager-only. */
export const GET = route({}, async ({ req, user }) => {
  if (searchParam(req, "options")) return listUserOptions();
  if (!can(user.role, "users:manage")) throw forbidden();
  return listUsers();
});
