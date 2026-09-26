"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, RefreshCcw } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, ROLES } from "@/lib/constants";
import { userCreateSchema, type UserCreateInput } from "@/lib/validation/auth";

const SETS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];

/** Random temporary password that always satisfies the password policy. */
function generatePassword(): string {
  const random = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
  const chars = [3, 4, 2, 1].flatMap((count, index) => Array.from({ length: count }, () => SETS[index][random(SETS[index].length)]));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { name: "", loginId: "", email: "", role: "staff", password: generatePassword() },
  });
  const save = useApiMutation<UserCreateInput>({
    mutationFn: (values) => api("/api/users", { method: "POST", body: values }),
    invalidate: [["users"]],
    success: "User created. Share the temporary password securely.",
    onSuccess: onDone,
    toastErrors: false,
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => save.mutateAsync(values).catch((error) => applyServerErrors(error, form.setError)))}
    >
      <FieldGroup className="gap-4">
        <TextField label="Full name" required placeholder="Meera Joshi" error={errors.name?.message} {...form.register("name")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Login ID"
            required
            placeholder="meera.j"
            description="6-12 characters."
            error={errors.loginId?.message}
            {...form.register("loginId")}
          />
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <SelectField
                label="Role"
                required
                value={field.value}
                onChange={field.onChange}
                options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                error={errors.role?.message}
              />
            )}
          />
        </div>
        <TextField label="Email" type="email" required placeholder="meera@company.com" error={errors.email?.message} {...form.register("email")} />
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="temporary-password">Temporary password</FieldLabel>
          <InputGroup>
            <InputGroupInput id="temporary-password" className="font-mono" aria-invalid={Boolean(errors.password)} {...form.register("password")} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Copy password"
                onClick={() => {
                  void navigator.clipboard?.writeText(form.getValues("password"));
                  toast.success("Password copied");
                }}
              >
                <Copy />
              </InputGroupButton>
              <InputGroupButton
                size="icon-xs"
                aria-label="Generate another password"
                onClick={() => form.setValue("password", generatePassword(), { shouldValidate: true })}
              >
                <RefreshCcw />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {errors.password ? (
            <FieldError>{errors.password.message}</FieldError>
          ) : (
            <FieldDescription>They can change it from My Profile after signing in.</FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Create user
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>Create an account for a colleague. Managers plan and configure; staff pick, move and count.</DialogDescription>
        </DialogHeader>
        {open && <AddUserForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
