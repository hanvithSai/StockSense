import { signupSchema } from "@/lib/validation/auth";
import { startSession, toSessionUser } from "@/server/auth/session";
import { parseBody, publicRoute } from "@/server/http";
import { signup } from "@/server/services/users";

export const POST = publicRoute(async ({ req }) => {
  const user = await signup(await parseBody(req, signupSchema));
  await startSession(user);
  return toSessionUser(user);
});
