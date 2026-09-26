"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { ProductSort, ProductSortKey } from "@/lib/product-sort";
import { cn } from "@/lib/utils";

/**
 * Column header that sorts the table: the first click sorts text A→Z and numbers high→low,
 * the next click reverses the order.
 */
export function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: ProductSortKey;
  sort: ProductSort;
  onSort: (sort: ProductSort) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const alignRight = className?.includes("text-right");

  function toggle() {
    if (active) onSort({ key: sortKey, direction: sort.direction === "asc" ? "desc" : "asc" });
    else onSort({ key: sortKey, direction: sortKey === "name" ? "asc" : "desc" });
  }

  return (
    <TableHead className={className} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "group inline-flex items-center gap-1 rounded-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          alignRight && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("size-3.5 transition-opacity", active ? "text-primary" : "opacity-35 group-hover:opacity-80")} />
      </button>
    </TableHead>
  );
}
