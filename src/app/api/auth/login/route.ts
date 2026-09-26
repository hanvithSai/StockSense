import { loginSchema } from "@/lib/validation/auth";
import { startSession, toSessionUser } from "@/server/auth/session";
import { parseBody, publicRoute } from "@/server/http";
import { login } from "@/server/services/users";

export const POST = publicRoute(async ({ req }) => {
  const user = await login(await parseBody(req, loginSchema));
  await startSession(user);
  return toSessionUser(user);
});
