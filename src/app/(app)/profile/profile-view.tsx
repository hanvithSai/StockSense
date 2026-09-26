"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { applyServerErrors, PasswordField, TextField } from "@/components/forms/fields";
import { PasswordRules } from "@/components/forms/password-rules";
import { useSession } from "@/components/layout/session-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordInput,
  type ProfileInput,
} from "@/lib/validation/auth";

const CAPABILITY_LABELS = [
  { capability: "operation:plan", label: "Create receipts and delivery orders" },
  { capability: "operation:process", label: "Pick, pack and validate operations" },
  { capability: "stock:move", label: "Internal transfers and stock counts" },
  { capability: "master:write", label: "Manage products, warehouses and rules" },
  { capability: "users:manage", label: "Manage users and roles" },
] as const;

export function ProfileView() {
  const router = useRouter();
  const { user } = useSession();

  const profile = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email },
  });
  const password = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = useWatch({ control: password.control, name: "newPassword" });

  async function saveProfile(values: ProfileInput) {
    try {
      await api("/api/profile", { method: "PATCH", body: values });
      toast.success("Profile updated");
      profile.reset(values);
      router.refresh();
    } catch (error) {
      applyServerErrors(error, profile.setError);
    }
  }

  async function changePassword(values: ChangePasswordInput) {
    try {
      await api("/api/profile/password", { method: "POST", body: values });
      toast.success("Password changed", { description: "Other sessions have been signed out." });
      password.reset();
    } catch (error) {
      applyServerErrors(error, password.setError);
    }
  }

  return (
    <>
      <PageHeader title="My Profile" description="Your account details, role and password." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:row-span-2">
          <CardContent className="flex flex-col items-center gap-3 pt-2 text-center">
            <Avatar className="size-20">
              <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck /> {ROLE_LABELS[user.role]}
            </Badge>
            <p className="font-mono text-xs text-muted-foreground">Login ID: {user.loginId}</p>
          </CardContent>
          <CardContent className="border-t pt-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Permissions</p>
            <ul className="space-y-1.5 text-sm">
              {CAPABILITY_LABELS.map((item) => {
                const allowed = can(user.role, item.capability);
                return (
                  <li key={item.capability} className={allowed ? "" : "text-muted-foreground line-through decoration-muted-foreground/40"}>
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <form noValidate onSubmit={profile.handleSubmit(saveProfile)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4" /> Account
              </CardTitle>
              <CardDescription>Your name appears as the responsible person on operations.</CardDescription>
            </CardHeader>
            <CardContent className="mt-4">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField label="Full name" error={profile.formState.errors.name?.message} {...profile.register("name")} />
                <TextField label="Email" type="email" error={profile.formState.errors.email?.message} {...profile.register("email")} />
              </FieldGroup>
            </CardContent>
            <CardFooter className="mt-4 justify-end">
              <Button type="submit" disabled={!profile.formState.isDirty || profile.formState.isSubmitting}>
                {profile.formState.isSubmitting && <Spinner />}
                Save changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <form noValidate onSubmit={password.handleSubmit(changePassword)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" /> Change password
              </CardTitle>
              <CardDescription>Changing your password signs out your other sessions.</CardDescription>
            </CardHeader>
            <CardContent className="mt-4">
              <FieldGroup className="gap-4">
                <PasswordField
                  label="Current password"
                  autoComplete="current-password"
                  error={password.formState.errors.currentPassword?.message}
                  {...password.register("currentPassword")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordField
                    label="New password"
                    autoComplete="new-password"
                    error={password.formState.errors.newPassword?.message}
                    {...password.register("newPassword")}
                  />
                  <PasswordField
                    label="Re-enter new password"
                    autoComplete="new-password"
                    error={password.formState.errors.confirmPassword?.message}
                    {...password.register("confirmPassword")}
                  />
                </div>
                <PasswordRules value={newPassword ?? ""} />
              </FieldGroup>
            </CardContent>
            <CardFooter className="mt-4 justify-end">
              <Button type="submit" disabled={password.formState.isSubmitting}>
                {password.formState.isSubmitting && <Spinner />}
                Update password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  );
}
