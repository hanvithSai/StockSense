"use client";

import { useId } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  description?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  error,
  description,
  required,
  disabled,
  className,
}: SelectFieldProps) {
  const id = useId();
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.hint && <span className="ml-auto pl-2 text-xs text-muted-foreground">{option.hint}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
