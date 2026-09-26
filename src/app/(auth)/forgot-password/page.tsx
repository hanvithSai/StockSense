import type { Metadata } from "next";
import { ForgotPasswordFlow } from "./forgot-password-flow";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordFlow />;
}
