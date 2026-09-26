"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, qs } from "@/lib/api-client";
import type { AuditEntity } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AuditLogDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActionIcon } from "./action-icon";

/** Chatter-style history of a record: who did what, and when. */
export function ActivityTimeline({
  entityType,
  entityId,
  className,
}: {
  entityType: AuditEntity;
  entityId: string;
  className?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity", entityType, entityId],
    queryFn: () => api<AuditLogDTO[]>(`/api/audit${qs({ entityType, entityId })}`),
  });

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" /> Activity
        </CardTitle>
        <CardDescription>Every change on this record, with its author.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-border">
            {data.map((entry) => (
              <li key={entry.id} className="relative flex gap-3">
                <ActionIcon action={entry.action} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm leading-snug">{entry.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground" title={formatDateTime(entry.createdAt)}>
                    <span className="font-medium text-foreground/80">{entry.userName}</span> · {formatRelative(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
