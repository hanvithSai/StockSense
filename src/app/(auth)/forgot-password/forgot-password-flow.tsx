"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { applyServerErrors, PasswordField, TextField } from "@/components/forms/fields";
import { PasswordRules } from "@/components/forms/password-rules";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";
import { forgotPasswordSchema, resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

type RequestResult = { message: string; devCode?: string };
const RESEND_SECONDS = 60;

export function ForgotPasswordFlow() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestForm = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "", otp: "", password: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control: resetForm.control, name: "password" });

  async function requestCode(address: string) {
    const result = await api<RequestResult>("/api/auth/forgot-password", { method: "POST", body: { email: address } });
    setEmail(address);
    setDevCode(result.devCode);
    setCooldown(RESEND_SECONDS);
    resetForm.setValue("email", address);
    toast.success("Check your inbox", { description: result.message });
  }

  async function onRequest(values: { email: string }) {
    try {
      await requestCode(values.email);
    } catch (error) {
      applyServerErrors(error, requestForm.setError);
    }
  }

  async function onReset(values: ResetPasswordInput) {
    try {
      await api("/api/auth/reset-password", { method: "POST", body: values });
      toast.success("Password updated", { description: "You are now signed in." });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      applyServerErrors(error, resetForm.setError);
    }
  }

  if (!email) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground">Enter your account email and we will send you a 6-digit code.</p>
        </div>
        <form onSubmit={requestForm.handleSubmit(onRequest)} noValidate className="space-y-5">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            error={requestForm.formState.errors.email?.message}
            {...requestForm.register("email")}
          />
          <Button type="submit" size="lg" className="h-10 w-full" disabled={requestForm.formState.isSubmitting}>
            {requestForm.formState.isSubmitting && <Spinner />}
            Send code
          </Button>
        </form>
        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  const { errors, isSubmitting } = resetForm.formState;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MailCheck className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Enter the code</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
        </p>
        {devCode && (
          <p className="rounded-lg border border-dashed border-info/40 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
            Demo mode (no mail server configured): your code is{" "}
            <span className="font-mono text-sm font-semibold tracking-widest text-foreground">{devCode}</span>
          </p>
        )}
      </div>

      <form onSubmit={resetForm.handleSubmit(onReset)} noValidate className="space-y-5">
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(errors.otp)}>
            <FieldLabel>Verification code</FieldLabel>
            <Controller
              control={resetForm.control}
              name="otp"
              render={({ field }) => (
                <InputOTP maxLength={6} value={field.value} onChange={field.onChange} autoFocus aria-invalid={Boolean(errors.otp)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              )}
            />
            {errors.otp && <FieldError>{errors.otp.message}</FieldError>}
          </Field>
          <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...resetForm.register("password")} />
          <PasswordRules value={newPassword ?? ""} />
          <PasswordField
            label="Re-enter new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...resetForm.register("confirmPassword")}
          />
        </FieldGroup>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Reset password
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={() => setEmail(null)} className="text-muted-foreground hover:text-foreground">
          Use another email
        </button>
        <Button
          variant="link"
          className="h-auto p-0"
          disabled={cooldown > 0}
          onClick={() => requestCode(email).catch((error) => toast.error(errorMessage(error)))}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
      </div>
    </div>
  );
}
