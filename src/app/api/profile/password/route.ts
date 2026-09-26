import { changePasswordSchema } from "@/lib/validation/auth";
import { startSession } from "@/server/auth/session";
import { parseBody, route } from "@/server/http";
import { changePassword } from "@/server/services/users";

export const POST = route({}, async ({ req, user }) => {
  const updated = await changePassword(user, await parseBody(req, changePasswordSchema));
  // Other sessions are invalidated by the new session version; keep this one signed in.
  await startSession(updated);
  return { ok: true };
});
