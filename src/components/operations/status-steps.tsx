import { Check } from "lucide-react";
import { OPERATION_META, STATUS_LABELS, type OperationStatus, type OperationType } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Odoo-style status bar, e.g. Draft › Waiting › Ready › Done. */
export function StatusSteps({ type, status }: { type: OperationType; status: OperationStatus | "new" }) {
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive ring-1 ring-destructive/20 ring-inset">
        Cancelled
      </span>
    );
  }
  const flow = OPERATION_META[type].flow;
  const current = status === "new" ? 0 : flow.indexOf(status);

  return (
    <ol className="flex items-center overflow-hidden rounded-lg border text-xs font-medium sm:text-sm" aria-label="Status">
      {flow.map((step, index) => {
        // "Waiting" is an optional step: once passed it is shown neutral, not as completed.
        const reached = (index < current && step !== "waiting") || (status === "done" && index === current);
        const active = index === current && status !== "done";
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3",
              index > 0 && "border-l",
              active && "bg-primary text-primary-foreground",
              reached && "bg-primary/8 text-primary",
              !active && !reached && "text-muted-foreground",
            )}
          >
            {reached && <Check className="size-3.5" />}
            {STATUS_LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
