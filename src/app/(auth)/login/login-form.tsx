"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { applyServerErrors, PasswordField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

const DEMO_ACCOUNTS = [
  { label: "Inventory Manager", loginId: "manager", password: "Manager@123" },
  { label: "Warehouse Staff", loginId: "warehouse", password: "Staff@1234" },
];

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: values });
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 429].includes(error.status)) setFormError(error.message);
      else applyServerErrors(error, setError);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your inventory.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FieldGroup className="gap-4">
          <TextField
            label="Login ID"
            autoComplete="username"
            placeholder="Login ID or email"
            autoFocus
            error={errors.identifier?.message}
            {...register("identifier")}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
        </FieldGroup>

        {formError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to StockSense?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>

      {demo && (
        <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-xs">
          <p className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-3.5" /> Demo accounts
          </p>
          <div className="grid gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.loginId}
                type="button"
                onClick={() => {
                  setValue("identifier", account.loginId);
                  setValue("password", account.password);
                }}
                className="flex items-center justify-between rounded-lg bg-background px-2.5 py-1.5 text-left ring-1 ring-border transition-colors hover:ring-primary/40"
              >
                <span className="text-muted-foreground">{account.label}</span>
                <span className="font-mono">
                  {account.loginId} / {account.password}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
