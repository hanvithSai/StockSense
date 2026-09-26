"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, parseISODate } from "@/lib/format";
import type { ActivityPointDTO } from "@/lib/types";

const SERIES = [
  { key: "receipt", label: "Receipts", color: "bg-emerald-500" },
  { key: "delivery", label: "Deliveries", color: "bg-rose-500" },
  { key: "internal", label: "Transfers", color: "bg-sky-500" },
  { key: "adjustment", label: "Adjustments", color: "bg-amber-500" },
] as const;

const total = (point: ActivityPointDTO) => SERIES.reduce((sum, series) => sum + point[series.key], 0);

/** Stacked bars of validated operations per day (lightweight, no chart library). */
export function ActivityChart({ data }: { data: ActivityPointDTO[] }) {
  const max = Math.max(1, ...data.map(total));
  const sum = data.reduce((acc, point) => acc + total(point), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          {sum} validated operation{sum === 1 ? "" : "s"} in the last {data.length} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex h-36 items-end gap-1" role="img" aria-label="Validated operations per day">
          {data.map((point) => {
            const count = total(point);
            return (
              <Tooltip key={point.date}>
                <TooltipTrigger asChild>
                  <div className="flex h-full flex-1 flex-col justify-end">
                    {count === 0 ? (
                      <div className="h-1 rounded-full bg-muted" />
                    ) : (
                      <div
                        className="flex flex-col-reverse overflow-hidden rounded-md transition-opacity hover:opacity-80"
                        style={{ height: `${Math.max(8, (count / max) * 100)}%` }}
                      >
                        {SERIES.map((series) =>
                          point[series.key] > 0 ? (
                            <div key={series.key} className={series.color} style={{ flexGrow: point[series.key] }} />
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{formatDate(point.date)}</p>
                  {count === 0 ? (
                    <p>No validated operations</p>
                  ) : (
                    SERIES.filter((series) => point[series.key] > 0).map((series) => (
                      <p key={series.key}>
                        {series.label}: {point[series.key]}
                      </p>
                    ))
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="flex gap-1 text-[10px] text-muted-foreground tabular">
          {data.map((point, index) => (
            <span key={point.date} className="flex-1 text-center">
              {index % 2 === data.length % 2 ? parseISODate(point.date).getDate() : ""}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${series.color}`} />
              {series.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
