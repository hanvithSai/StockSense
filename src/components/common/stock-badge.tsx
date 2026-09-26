import type { StockStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LABELS: Record<StockStatus, string> = { ok: "In stock", low: "Low stock", out: "Out of stock" };
const STYLES: Record<StockStatus, string> = {
  ok: "bg-success/12 text-emerald-800 ring-success/30 dark:text-emerald-300",
  low: "bg-warning/15 text-amber-800 ring-warning/30 dark:text-amber-300",
  out: "bg-destructive/10 text-destructive ring-destructive/25",
};

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
