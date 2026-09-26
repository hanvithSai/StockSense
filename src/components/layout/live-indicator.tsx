"use client";

import { useIsFetching } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Shows that data is live (auto-refreshing) and when a sync is in progress. */
export function LiveIndicator() {
  const syncing = useIsFetching() > 0;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="mr-1 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground lg:inline-flex">
          <span className="relative flex size-2">
            {!syncing && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={cn("relative inline-flex size-2 rounded-full", syncing ? "bg-amber-400" : "bg-emerald-500")} />
          </span>
          {syncing ? "Syncing" : "Live"}
        </span>
      </TooltipTrigger>
      <TooltipContent>Data refreshes automatically every 15 seconds and after every change</TooltipContent>
    </Tooltip>
  );
}
