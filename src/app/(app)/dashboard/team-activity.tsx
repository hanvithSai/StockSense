"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ActionIcon } from "@/components/activity/action-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { LIVE_REFRESH_MS } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AuditLogDTO } from "@/lib/types";

/** Latest operation milestones and notes by the whole team (visible to every role). */
export function TeamActivity() {
  const { data } = useQuery({
    queryKey: ["audit", "team"],
    queryFn: () => api<AuditLogDTO[]>("/api/audit?feed=team"),
    refetchInterval: LIVE_REFRESH_MS,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team activity</CardTitle>
        <CardDescription>Who confirmed, validated or commented on what.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-48" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-border">
            {data.map((entry) => (
              <li key={entry.id} className="relative flex gap-3">
                <ActionIcon action={entry.action} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="line-clamp-2 text-sm leading-snug">
                    {entry.link ? (
                      <Link href={entry.link} className="font-mono font-semibold hover:underline">
                        {entry.entityLabel}
                      </Link>
                    ) : (
                      <span className="font-mono font-semibold">{entry.entityLabel}</span>
                    )}{" "}
                    <span className={entry.action === "note" ? "italic" : undefined}>{entry.message}</span>
                  </p>
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
