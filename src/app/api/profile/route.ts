import { profileSchema } from "@/lib/validation/auth";
import { getCurrentUser } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { updateProfile } from "@/server/services/users";

export const GET = route({}, async ({ user }) => user);

export const PATCH = route({}, async ({ req, user }) => {
  await updateProfile(user, await parseBody(req, profileSchema));
  return getCurrentUser();
});
