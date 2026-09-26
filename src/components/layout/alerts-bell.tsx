"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, CircleCheck, Hourglass, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StockBadge } from "@/components/common/stock-badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, qs } from "@/lib/api-client";
import { LIVE_REFRESH_MS } from "@/lib/constants";
import { formatQty, todayISO } from "@/lib/format";
import type { AlertsDTO } from "@/lib/types";

/** Low stock / out of stock alerts plus waiting and late operations, refreshed live. */
export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<AlertsDTO>(`/api/alerts${qs({ today: todayISO() })}`),
    refetchInterval: LIVE_REFRESH_MS * 2,
  });
  const count = (data?.lowCount ?? 0) + (data?.outCount ?? 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${count} stock alerts`}>
          <Bell />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white dark:bg-red-700">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Stock alerts</p>
          <span className="text-xs text-muted-foreground">
            {data?.outCount ?? 0} out · {data?.lowCount ?? 0} low
          </span>
        </div>
        {(data?.waitingCount || data?.lateCount) ? (
          <div className="flex gap-2 border-b px-4 py-2 text-xs">
            {data.waitingCount > 0 && (
              <Link
                href="/operations/deliveries?status=waiting"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-foreground hover:bg-warning/25"
              >
                <Hourglass className="size-3" /> {data.waitingCount} waiting
              </Link>
            )}
            {data.lateCount > 0 && (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/15"
              >
                <TriangleAlert className="size-3" /> {data.lateCount} late
              </Link>
            )}
          </div>
        ) : null}
        {data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
            <CircleCheck className="size-6 text-success" />
            All products are above their reorder levels.
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {data?.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/products/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{item.sku}</span> · {formatQty(item.onHand)} {item.uom}
                        {item.minQty !== null && ` (min ${formatQty(item.minQty)})`}
                      </p>
                    </div>
                    <StockBadge status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/products/reordering" onClick={() => setOpen(false)}>
              View reordering rules
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
