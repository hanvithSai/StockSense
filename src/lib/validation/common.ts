import { z } from "zod";
import { MAX_QUANTITY } from "@/lib/constants";

export const objectId = (message = "Invalid reference") =>
  z.string({ error: message }).regex(/^[a-f\d]{24}$/i, message);

/** An id that may be left empty in forms ("" means "not set"). */
export const optionalObjectId = z
  .string()
  .regex(/^([a-f\d]{24})?$/i, "Invalid reference")
  .optional();

export const isoDate = z
  .string({ error: "Select a date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Select a valid date");

function hasAtMostThreeDecimals(value: number) {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
}

/** Non-negative quantity with at most 3 decimals. */
export const quantity = z
  .number({ error: "Enter a quantity" })
  .min(0, "Quantity cannot be negative")
  .max(MAX_QUANTITY, "Quantity is too large")
  .refine(hasAtMostThreeDecimals, "Use at most 3 decimals");

export const positiveQuantity = quantity.refine((value) => value > 0, "Quantity must be greater than 0");

export const money = z
  .number({ error: "Enter an amount" })
  .min(0, "Amount cannot be negative")
  .max(100_000_000, "Amount is too large")
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most 2 decimals");

export const shortText = (max: number, label = "This field") =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

/** Converts a form value from `<input type="number">` to a number or undefined when empty. */
export function toOptionalNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Flattens zod issues into `{ "lines.0.quantity": "message" }` (first message per field). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    fields[key] ??= issue.message;
  }
  return fields;
}
