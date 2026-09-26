"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCheck, ListChecks, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useSession } from "@/components/layout/session-context";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api-client";
import { OPERATION_META, type OperationStatus, type OperationType } from "@/lib/constants";
import { runTransition, transitionActions } from "@/lib/operation-transitions";
import { actionCapability } from "@/lib/permissions";
import type { OperationListItemDTO } from "@/lib/types";

type BulkKind = "todo" | "validate" | "cancel";

const BULK: Record<BulkKind, { label: string; target: OperationStatus; progress: string; done: string; icon: LucideIcon }> = {
  todo: { label: "Mark as To Do", target: "ready", progress: "Confirming", done: "confirmed", icon: ListChecks },
  validate: { label: "Validate", target: "done", progress: "Validating", done: "validated", icon: CheckCheck },
  cancel: { label: "Cancel", target: "cancelled", progress: "Cancelling", done: "cancelled", icon: Ban },
};

/** Operations that bulk actions can still change (done and cancelled ones are final here). */
export function isBulkSelectable(item: OperationListItemDTO) {
  return item.status !== "done" && item.status !== "cancelled";
}

interface Job {
  item: OperationListItemDTO;
  actions: NonNullable<ReturnType<typeof transitionActions>>;
}

function FailureList({ failures, promoted }: { failures: string[]; promoted: string[] }) {
  return (
    <div className="space-y-1">
      {failures.slice(0, 4).map((failure) => (
        <p key={failure}>{failure}</p>
      ))}
      {failures.length > 4 && <p>and {failures.length - 4} more</p>}
      {promoted.length > 0 && <p>Now ready: {promoted.join(", ")}</p>}
    </div>
  );
}

/**
 * Action bar for the rows selected in an operation list: runs the same engine transitions as the
 * detail page, one operation after another, then reports what succeeded and why the rest did not.
 */
export function BulkActions({
  type,
  selected,
  onClear,
}: {
  type: OperationType;
  selected: OperationListItemDTO[];
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState<BulkKind | null>(null);
  const meta = OPERATION_META[type];

  function jobsFor(kind: BulkKind): Job[] {
    return selected.flatMap((item) => {
      // Bulk "To Do" only confirms drafts; waiting operations are re-checked from their own page.
      if (kind === "todo" && item.status !== "draft") return [];
      const actions = transitionActions(type, item.status, BULK[kind].target);
      if (!actions || !actions.every((action) => can(actionCapability(type, action)))) return [];
      return [{ item, actions }];
    });
  }

  async function run(kind: BulkKind) {
    const jobs = jobsFor(kind);
    if (!jobs.length) return;
    const spec = BULK[kind];
    const noun = (count: number) => (count === 1 ? meta.label : meta.plural).toLowerCase();
    const failures: string[] = [];
    const promoted = new Set<string>();
    let waiting = 0;

    setRunning(true);
    const toastId = toast.loading(`${spec.progress} ${jobs.length} ${noun(jobs.length)}…`);
    for (const [index, { item, actions }] of jobs.entries()) {
      toast.loading(`${spec.progress} ${item.reference} (${index + 1} of ${jobs.length})…`, { id: toastId });
      try {
        const result = await runTransition(item.id, actions, { allowWaiting: kind === "todo" });
        if (result.operation.status === "waiting") waiting += 1;
        result.promoted.forEach((reference) => promoted.add(reference));
      } catch (error) {
        failures.push(`${item.reference}: ${errorMessage(error)}`);
      }
    }

    const succeeded = jobs.length - failures.length;
    const details = [...promoted];
    if (!failures.length) {
      toast.success(`${succeeded} ${noun(succeeded)} ${spec.done}`, {
        id: toastId,
        description:
          [waiting ? `${waiting} waiting for stock` : "", details.length ? `Now ready: ${details.join(", ")}` : ""]
            .filter(Boolean)
            .join(" · ") || undefined,
      });
    } else {
      const report = succeeded ? toast.warning : toast.error;
      report(succeeded ? `${succeeded} of ${jobs.length} ${noun(jobs.length)} ${spec.done}` : `No ${noun(2)} ${spec.done}`, {
        id: toastId,
        description: <FailureList failures={failures} promoted={details} />,
        duration: 10000,
      });
    }

    await queryClient.invalidateQueries();
    setRunning(false);
    onClear();
  }

  const kinds: BulkKind[] = type === "adjustment" ? ["validate", "cancel"] : ["todo", "validate", "cancel"];
  const pending = confirming ? jobsFor(confirming).length : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-3 py-1.5">
      <span className="shrink-0 text-sm font-medium">{selected.length} selected</span>
      <div className="order-last flex w-full flex-wrap items-center gap-1.5 sm:order-none sm:w-auto">
        {kinds.map((kind) => {
          const count = jobsFor(kind).length;
          const Icon = BULK[kind].icon;
          return (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={kind === "cancel" ? "outline" : kind === "validate" ? "default" : "secondary"}
              disabled={running || count === 0}
              onClick={() => (kind === "todo" ? void run(kind) : setConfirming(kind))}
            >
              <Icon /> {BULK[kind].label}
              {count > 0 && <span className="tabular opacity-70">{count}</span>}
            </Button>
          );
        })}
      </div>
      <Button type="button" size="sm" variant="ghost" className="ml-auto shrink-0" onClick={onClear} disabled={running}>
        <X /> Clear
      </Button>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming === "cancel"
            ? `Cancel ${pending} ${(pending === 1 ? meta.label : meta.plural).toLowerCase()}?`
            : `Validate ${pending} ${(pending === 1 ? meta.label : meta.plural).toLowerCase()}?`
        }
        description={
          confirming === "cancel"
            ? "Reserved stock is released. Cancelled operations can be reset to draft later."
            : "Stock is updated for each one right away. Anything short of stock is skipped and reported."
        }
        confirmLabel={confirming === "cancel" ? "Cancel them" : "Validate"}
        cancelLabel="Back"
        destructive={confirming === "cancel"}
        onConfirm={() => confirming && void run(confirming)}
      />
    </div>
  );
}
