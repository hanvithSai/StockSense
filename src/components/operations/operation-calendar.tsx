"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { STATUS_STYLES, StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api, qs } from "@/lib/api-client";
import { LIVE_REFRESH_MS, operationPath, type OperationStatus, type OperationType } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import type { OperationListDTO, OperationListItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHIPS_PER_DAY = 3;
/** Work that still needs attention is listed first in each day. */
const STATUS_ORDER: Record<OperationStatus, number> = { waiting: 0, ready: 1, draft: 2, done: 3, cancelled: 4 };
const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

export interface CalendarFilters {
  q: string;
  warehouse: string;
  late: boolean;
  responsible: string;
}

function Chip({ item }: { item: OperationListItemDTO }) {
  return (
    <Link
      href={operationPath(item.type, item.id)}
      title={[item.reference, item.contact || item.productSummary].filter(Boolean).join(" · ")}
      className={cn(
        "flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset transition hover:ring-primary/50",
        STATUS_STYLES[item.status],
        item.status === "cancelled" && "line-through",
      )}
    >
      {item.isLate && <TriangleAlert className="size-3 shrink-0 text-destructive" />}
      <span className="truncate">{item.reference}</span>
    </Link>
  );
}

/** Month view of operations by scheduled date (agenda list on small screens). */
export function OperationCalendar({ type, filters }: { type: OperationType; filters: CalendarFilters }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const today = todayISO();
  const params = {
    type,
    q: filters.q,
    warehouse: filters.warehouse,
    late: filters.late ? 1 : "",
    responsible: filters.responsible,
    scheduledFrom: isoDay(days[0]),
    scheduledTo: isoDay(days[days.length - 1]),
    sort: "schedule",
    today,
    limit: 200,
  };
  const { data } = useQuery({
    queryKey: ["operations", "calendar", params],
    queryFn: () => api<OperationListDTO>(`/api/operations${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const byDay = new Map<string, OperationListItemDTO[]>();
  for (const item of data?.items ?? []) {
    byDay.set(item.scheduledDate, [...(byDay.get(item.scheduledDate) ?? []), item]);
  }
  for (const items of byDay.values()) items.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const agendaDays = days.filter((day) => isSameMonth(day, month) && byDay.has(isoDay(day)));

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((current) => addMonths(current, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth((current) => addMonths(current, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="px-2 py-1.5">
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const key = isoDay(day);
                const items = byDay.get(key) ?? [];
                const inMonth = isSameMonth(day, month);
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-28 min-w-0 border-r border-b p-1.5",
                      (index + 1) % 7 === 0 && "border-r-0",
                      !inMonth && "bg-muted/30",
                      index >= days.length - 7 && "border-b-0",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-xs tabular",
                          key === today ? "bg-primary font-semibold text-primary-foreground" : !inMonth && "text-muted-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, CHIPS_PER_DAY).map((item) => (
                        <Chip key={item.id} item={item} />
                      ))}
                      {items.length > CHIPS_PER_DAY && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                              +{items.length - CHIPS_PER_DAY} more
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-60 space-y-1 p-2">
                            <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{format(day, "EEEE d MMMM")}</p>
                            {items.map((item) => (
                              <Chip key={item.id} item={item} />
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            {agendaDays.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing scheduled this month.</p>}
            {agendaDays.map((day) => (
              <div key={isoDay(day)}>
                <p className={cn("mb-1.5 text-xs font-medium text-muted-foreground", isoDay(day) === today && "text-primary")}>
                  {format(day, "EEEE d MMMM")}
                </p>
                <div className="divide-y rounded-lg border">
                  {byDay.get(isoDay(day))!.map((item) => (
                    <Link key={item.id} href={operationPath(item.type, item.id)} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold">{item.reference}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.contact || item.productSummary}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {data.total > data.items.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing the first {data.items.length} of {data.total} operations. Narrow the filters to see the rest.
            </p>
          )}
        </>
      )}
    </div>
  );
}
