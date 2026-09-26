"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, qs } from "@/lib/api-client";
import type { AuditEntity } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AuditLogDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActionIcon } from "./action-icon";

/** Chatter-style history of a record (who did what, and when) with a "log note" composer. */
export function ActivityTimeline({
  entityType,
  entityId,
  className,
}: {
  entityType: AuditEntity;
  entityId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const queryKey = ["activity", entityType, entityId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api<AuditLogDTO[]>(`/api/audit${qs({ entityType, entityId })}`),
  });
  const canNote = entityType === "operation" || entityType === "product";

  async function send() {
    if (!note.trim()) return;
    setSending(true);
    try {
      await api("/api/audit", { method: "POST", body: { entityType, entityId, message: note } });
      setNote("");
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" /> Activity
        </CardTitle>
        <CardDescription>Every change on this record, with its author.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canNote && (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={1000}
              placeholder="Log a note for your team…"
              aria-label="Log a note"
              className="min-h-16 resize-none text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ctrl + Enter to post</span>
              <Button size="sm" onClick={send} disabled={sending || !note.trim()}>
                {sending ? <Spinner /> : <Send />} Log note
              </Button>
            </div>
          </div>
        )}
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
                  {entry.action === "note" ? (
                    <p className="rounded-lg rounded-tl-none bg-muted px-3 py-2 text-sm leading-snug whitespace-pre-line">{entry.message}</p>
                  ) : (
                    <p className="text-sm leading-snug">{entry.message}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(entry.createdAt)}>
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
