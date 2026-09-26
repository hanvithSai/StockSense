"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/lib/api-client";

interface FieldShellProps {
  label: string;
  error?: string;
  description?: React.ReactNode;
  required?: boolean;
}

type TextFieldProps = FieldShellProps & React.ComponentProps<typeof Input>;

export function TextField({ label, error, description, required, id, className, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Input id={inputId} aria-invalid={Boolean(error)} {...props} />
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

type TextareaFieldProps = FieldShellProps & React.ComponentProps<typeof Textarea>;

export function TextareaField({ label, error, description, required, id, className, ...props }: TextareaFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Textarea id={inputId} aria-invalid={Boolean(error)} {...props} />
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function PasswordField({ label, error, description, required, id, className, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput id={inputId} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} {...props} />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

/** Maps API field errors onto the form (falls back to a toast for general errors). */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields?: string[]) {
  if (error instanceof ApiError && error.fields) {
    let mapped = false;
    for (const [name, message] of Object.entries(error.fields)) {
      if (!fields || fields.includes(name)) {
        setError(name as Path<T>, { type: "server", message });
        mapped = true;
      }
    }
    if (mapped) {
      toast.error(error.message);
      return;
    }
  }
  toast.error(errorMessage(error));
}
