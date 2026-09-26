import { forgotPasswordSchema } from "@/lib/validation/auth";
import { parseBody, publicRoute } from "@/server/http";
import { requestPasswordReset } from "@/server/services/users";

export const POST = publicRoute(async ({ req }) => {
  const { email } = await parseBody(req, forgotPasswordSchema);
  return requestPasswordReset(email);
});
