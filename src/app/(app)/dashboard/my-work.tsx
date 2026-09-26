"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeftRight, CircleCheck, ClipboardCheck, TriangleAlert, Truck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import { useSession } from "@/components/layout/session-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, qs } from "@/lib/api-client";
import { LIVE_REFRESH_MS, OPEN_STATUSES, operationPath, type OperationType } from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import type { OperationListDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<OperationType, LucideIcon> = {
  receipt: ArrowDownToLine,
  delivery: Truck,
  internal: ArrowLeftRight,
  adjustment: ClipboardCheck,
};

/** Open operations assigned to the signed-in user, most urgent first. */
export function MyWork() {
  const { user } = useSession();
  const params = { responsible: user.id, status: [...OPEN_STATUSES], sort: "schedule", today: todayISO(), limit: 5 };
  const { data } = useQuery({
    queryKey: ["operations", "mine", params],
    queryFn: () => api<OperationListDTO>(`/api/operations${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });
  // Most urgent first, so late items are always the ones shown; "5+" when there may be more beyond the list.
  const late = data?.items.filter((item) => item.isLate).length ?? 0;
  const lateLabel = data && late === data.items.length && data.total > late ? `${late}+` : `${late}`;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>My work</CardTitle>
        <CardDescription>Open operations assigned to you, most urgent first.</CardDescription>
        {data && data.total > 0 && (
          <CardAction>
            <Badge variant={late ? "destructive" : "secondary"} className="tabular">
              {data.total} open{late ? ` · ${lateLabel} late` : ""}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {!data ? (
          <Skeleton className="h-40" />
        ) : data.items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-success" /> Nothing assigned to you right now.
          </p>
        ) : (
          <>
            {data.items.map((item) => {
              const Icon = TYPE_ICONS[item.type];
              return (
                <Link
                  key={item.id}
                  href={operationPath(item.type, item.id)}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-mono font-semibold">{item.reference}</span>
                      <span className="text-muted-foreground"> · {item.contact || item.productSummary}</span>
                    </p>
                    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", item.isLate && "font-medium text-destructive")}>
                      {item.isLate && <TriangleAlert className="size-3" />}
                      {item.isLate ? "Late since" : "Scheduled"} {formatDate(item.scheduledDate)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              );
            })}
            {data.total > data.items.length && (
              <p className="pt-1 text-xs text-muted-foreground">
                {data.total - data.items.length} more in the lists: use the <span className="font-medium">Assigned to me</span> filter.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
