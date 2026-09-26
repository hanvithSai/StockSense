"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, qs } from "@/lib/api-client";
import { operationPath, STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatQty, todayISO } from "@/lib/format";
import type { ProductForecastDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Forecasted stock: planned receipts and deliveries in date order with the quantity left after each. */
export function ProductForecast({ productId, uom, minQty }: { productId: string; uom: string; minQty: number | null }) {
  const { data } = useQuery({
    queryKey: ["forecast", productId],
    queryFn: () => api<ProductForecastDTO>(`/api/products/${productId}/forecast${qs({ today: todayISO() })}`),
  });
  const shortage = data?.rows.find((row) => row.projected < 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" /> Forecast
        </CardTitle>
        <CardDescription>Planned receipts and deliveries, with the stock left after each.</CardDescription>
        {shortage && (
          <CardAction>
            <Badge variant="destructive">Short on {formatDate(shortage.scheduledDate)}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-24" />
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No receipts or deliveries planned for this product.</p>
        ) : (
          <ol className="space-y-0.5">
            <li className="flex items-center justify-between py-1 text-sm text-muted-foreground">
              <span>On hand now</span>
              <span className="font-medium text-foreground tabular">
                {formatQty(data.onHand)} {uom}
              </span>
            </li>
            {data.rows.map((row) => (
              <li key={row.operationId}>
                <Link
                  href={operationPath(row.type, row.operationId)}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="font-mono font-medium">{row.reference}</span>
                      {row.contact && <span className="text-muted-foreground"> · {row.contact}</span>}
                    </p>
                    <p className={cn("text-xs text-muted-foreground", row.isLate && "font-medium text-destructive")}>
                      {row.isLate ? "Late · " : ""}
                      {formatDate(row.scheduledDate)} · {STATUS_LABELS[row.status]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right tabular">
                    <p className={cn("text-sm font-medium", row.change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {row.change > 0 ? "+" : "−"}
                      {formatQty(Math.abs(row.change))}
                    </p>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground",
                        row.projected < 0
                          ? "font-medium text-destructive"
                          : minQty !== null && row.projected <= minQty && "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      → {formatQty(row.projected)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
