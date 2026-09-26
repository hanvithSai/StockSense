"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { applyServerErrors, PasswordField, TextField } from "@/components/forms/fields";
import { PasswordRules } from "@/components/forms/password-rules";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/constants";
import type { SessionUser } from "@/lib/types";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export function SignupForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: { name: "", loginId: "", email: "", password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" });

  async function onSubmit(values: SignupInput) {
    try {
      const user = await api<SessionUser>("/api/auth/signup", { method: "POST", body: values });
      toast.success(`Welcome, ${user.name}!`, { description: `You joined as ${ROLE_LABELS[user.role]}.` });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      applyServerErrors(error, setError);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start tracking stock in minutes.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FieldGroup className="gap-4">
          <TextField label="Full name" autoComplete="name" placeholder="Priya Sharma" error={errors.name?.message} {...register("name")} />
          <TextField
            label="Login ID"
            autoComplete="username"
            placeholder="priya.s"
            description="6-12 characters: letters, numbers, dot, underscore or hyphen."
            error={errors.loginId?.message}
            {...register("loginId")}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="priya@company.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <PasswordField label="Password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <PasswordRules value={password ?? ""} />
          <PasswordField
            label="Re-enter password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </FieldGroup>

        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Sign up
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
