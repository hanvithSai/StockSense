"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, GripVertical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/common/status-badge";
import { useSession } from "@/components/layout/session-context";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { errorMessage } from "@/lib/api-client";
import {
  OPERATION_META,
  operationPath,
  STATUS_LABELS,
  type OperationStatus,
  type OperationType,
} from "@/lib/constants";
import { formatDate, initials } from "@/lib/format";
import { runTransition, transitionActions } from "@/lib/operation-transitions";
import { actionCapability } from "@/lib/permissions";
import type { OperationListItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { OperationAction } from "@/lib/validation/operations";

export function OperationKanban({ type, items }: { type: OperationType; items: OperationListItemDTO[] }) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [dragging, setDragging] = useState<OperationListItemDTO | null>(null);
  const [over, setOver] = useState<OperationStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const columns: OperationStatus[] = [...OPERATION_META[type].flow, "cancelled"];

  const allowed = (actions: OperationAction[] | null) =>
    Boolean(actions) &&
    actions!.every((action) => can(actionCapability(type, action)));

  async function move(item: OperationListItemDTO, to: OperationStatus) {
    const actions = transitionActions(type, item.status, to);
    if (!actions || !allowed(actions)) return;
    setBusy(item.id);
    const promise = runTransition(item.id, actions, { allowWaiting: to === "waiting" });
    toast.promise(promise, {
      loading: `Moving ${item.reference} to ${STATUS_LABELS[to]}…`,
      success: (result) =>
        `${item.reference} is now ${STATUS_LABELS[result.operation.status]}${result.promoted.length ? ` · now ready: ${result.promoted.join(", ")}` : ""}`,
      error: (error) => `${item.reference}: ${errorMessage(error)}`,
    });
    try {
      await promise;
    } catch {
      // Reported by the toast above.
    } finally {
      setBusy(null);
      await queryClient.invalidateQueries();
    }
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 p-3">
        {columns.map((status) => {
          const cards = items.filter((item) => item.status === status);
          const actions = dragging ? transitionActions(type, dragging.status, status) : null;
          const droppable = Boolean(dragging) && allowed(actions);
          return (
            <div
              key={status}
              onDragOver={(event) => {
                if (!droppable) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOver(status);
              }}
              onDragLeave={() => setOver((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                if (dragging && droppable) void move(dragging, status);
                setDragging(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 p-2 transition-all",
                dragging && !droppable && dragging.status !== status && "opacity-50",
                droppable && "ring-2 ring-primary/25 ring-dashed",
                over === status && "bg-primary/8 ring-primary/60",
              )}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold">{STATUS_LABELS[status]}</span>
                <span className="rounded-full bg-background px-2 text-xs text-muted-foreground tabular">{cards.length}</span>
              </div>
              <div className="-mr-1 flex max-h-[calc(100svh-19rem)] min-h-24 flex-col gap-2 overflow-y-auto pr-1">
                {cards.map((item) => (
                  <Link
                    key={item.id}
                    href={operationPath(type, item.id)}
                    draggable={item.status !== "done"}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                      setDragging(item);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      "group rounded-lg border bg-card p-3 shadow-xs transition hover:border-primary/40 hover:shadow-sm",
                      item.status !== "done" && "cursor-grab active:cursor-grabbing",
                      dragging?.id === item.id && "opacity-40",
                      busy === item.id && "animate-pulse",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 font-mono text-sm font-semibold">
                        {item.status !== "done" && (
                          <GripVertical className="-ml-1 size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground" />
                        )}
                        {item.reference}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.contact && <p className="mt-1 truncate text-sm">{item.contact}</p>}
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.productSummary || "No products"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span className={cn("flex items-center gap-1", item.isLate && "font-medium text-destructive")}>
                        <CalendarClock className="size-3.5" />
                        {formatDate(item.scheduledDate)}
                      </span>
                      {item.responsibleName && (
                        <span
                          title={item.responsibleName}
                          className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                        >
                          {initials(item.responsibleName)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                {dragging && droppable && cards.length === 0 && (
                  <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-primary/30 text-xs text-muted-foreground">
                    Drop to move here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
