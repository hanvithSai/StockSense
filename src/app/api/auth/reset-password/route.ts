import { resetPasswordSchema } from "@/lib/validation/auth";
import { startSession, toSessionUser } from "@/server/auth/session";
import { parseBody, publicRoute } from "@/server/http";
import { resetPassword } from "@/server/services/users";

export const POST = publicRoute(async ({ req }) => {
  const user = await resetPassword(await parseBody(req, resetPasswordSchema));
  await startSession(user);
  return toSessionUser(user);
});
