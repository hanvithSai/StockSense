import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm demo={process.env.NEXT_PUBLIC_DEMO_MODE === "true"} />
    </Suspense>
  );
}
