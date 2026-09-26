import { format, formatDistanceToNowStrict } from "date-fns";

/** Quantities keep at most 3 decimals (kg, litres) and are rounded after every change. */
export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

const qtyFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatQty(value: number | null | undefined): string {
  return qtyFormatter.format(value ?? 0);
}

export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(value ?? 0);
}

export function formatCompact(value: number | null | undefined): string {
  return compactFormatter.format(value ?? 0);
}

/** Parses a `YYYY-MM-DD` date as a local calendar date (no timezone shift). */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseISODate(value)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM yyyy");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM yyyy, HH:mm");
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : `${formatDistanceToNowStrict(date)} ago`;
}

/** Today's local calendar date as `YYYY-MM-DD`. */
export function todayISO(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** The `count` calendar days ending at `today` (inclusive), as `YYYY-MM-DD`. */
export function lastDays(today: string, count: number): string[] {
  const [year, month, day] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (count - 1 - index))).toISOString().slice(0, 10),
  );
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
