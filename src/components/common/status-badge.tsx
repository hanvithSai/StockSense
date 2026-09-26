import { STATUS_LABELS, type OperationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const STATUS_STYLES: Record<OperationStatus, string> = {
  draft: "bg-muted text-muted-foreground ring-border",
  waiting: "bg-warning/15 text-amber-700 ring-warning/30 dark:text-amber-300",
  ready: "bg-info/12 text-sky-700 ring-info/30 dark:text-sky-300",
  done: "bg-success/12 text-emerald-700 ring-success/30 dark:text-emerald-300",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/25",
};

const DOTS: Record<OperationStatus, string> = {
  draft: "bg-muted-foreground/60",
  waiting: "bg-warning",
  ready: "bg-info",
  done: "bg-success",
  cancelled: "bg-destructive",
};

export function StatusBadge({ status, className }: { status: OperationStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOTS[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}
