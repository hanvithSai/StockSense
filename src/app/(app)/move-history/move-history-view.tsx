"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { FilterSelect } from "@/components/common/filter-select";
import { MoveQuantity } from "@/components/common/move-quantity";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { ViewToggle, type ViewMode } from "@/components/common/view-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWarehouses } from "@/hooks/use-reference-data";
import { api, errorMessage, qs } from "@/lib/api-client";
import {
  LIVE_REFRESH_MS,
  OPERATION_META,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  operationPath,
  STATUS_LABELS,
} from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { formatDate, todayISO } from "@/lib/format";
import type { MoveRowDTO, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIRECTIONS = [
  { value: "in", label: "Incoming" },
  { value: "out", label: "Outgoing" },
  { value: "internal", label: "Internal" },
];

const ROW_ACCENT = {
  in: "border-l-emerald-500",
  out: "border-l-destructive",
  internal: "border-l-sky-500",
};

export function MoveHistoryView() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 250);
  const { data: warehouses = [] } = useWarehouses();
  const kanban = view === "kanban";

  const params = { q, type, direction, status: kanban ? "" : status, warehouse, page: kanban ? 1 : page, limit: kanban ? 200 : 25 };
  const { data, isLoading } = useQuery({
    queryKey: ["moves", params],
    queryFn: () => api<Paginated<MoveRowDTO>>(`/api/moves${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const reset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: MoveRowDTO[] = [];
      for (let next = 1; next <= 50; next += 1) {
        const batch = await api<Paginated<MoveRowDTO>>(`/api/moves${qs({ ...params, status, page: next, limit: 200 })}`);
        rows.push(...batch.items);
        if (rows.length >= batch.total || batch.items.length === 0) break;
      }
      downloadCsv(
        `move-history-${todayISO()}.csv`,
        ["Reference", "Type", "Date", "Contact", "Product", "SKU", "From", "To", "Direction", "Quantity", "Unit", "Status"],
        rows.map((move) => [
          move.reference,
          OPERATION_META[move.type].label,
          formatDate(move.date),
          move.contact,
          move.productName,
          move.sku,
          move.from,
          move.to,
          move.direction,
          move.direction === "out" ? -move.quantity : move.quantity,
          move.uom,
          STATUS_LABELS[move.status],
        ]),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Move History"
        description="Every product movement between locations. Incoming moves are green, outgoing moves red."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={exporting || !data?.total}>
            {exporting ? <Spinner /> : <Download />} Export CSV
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search reference, contact or product…" />
          <FilterSelect
            value={type}
            onChange={reset(setType)}
            allLabel="All operations"
            options={OPERATION_TYPES.map((value) => ({ value, label: OPERATION_META[value].plural }))}
          />
          <FilterSelect value={direction} onChange={reset(setDirection)} allLabel="All directions" options={DIRECTIONS} className="sm:w-36" />
          {!kanban && (
            <FilterSelect
              value={status}
              onChange={reset(setStatus)}
              allLabel="All statuses"
              options={OPERATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
              className="sm:w-36"
            />
          )}
          <FilterSelect
            value={warehouse}
            onChange={reset(setWarehouse)}
            allLabel="All warehouses"
            options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <div className="ml-auto">
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>

        {kanban ? (
          <ScrollArea className="w-full">
            <div className="flex gap-4 p-3">
              {OPERATION_STATUSES.map((column) => {
                const cards = data?.items.filter((move) => move.status === column) ?? [];
                return (
                  <div key={column} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 p-2">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm font-semibold">{STATUS_LABELS[column]}</span>
                      <span className="rounded-full bg-background px-2 text-xs text-muted-foreground tabular">{cards.length}</span>
                    </div>
                    <div className="flex min-h-24 flex-col gap-2">
                      {cards.map((move) => (
                        <Link
                          key={move.id}
                          href={operationPath(move.type, move.operationId)}
                          className={cn("rounded-lg border border-l-4 bg-card p-3 shadow-xs transition hover:shadow-sm", ROW_ACCENT[move.direction])}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold">{move.reference}</span>
                            <MoveQuantity direction={move.direction} quantity={move.quantity} />
                          </div>
                          <p className="mt-1 truncate text-sm font-medium">{move.productName}</p>
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {move.from} → {move.to}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden xl:table-cell">Contact</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">From</TableHead>
                  <TableHead className="hidden md:table-cell">To</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columns={8} />
                ) : !data?.items.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8}>
                      <EmptyState icon={History} title="No moves found" description="Moves appear once operations are created." />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((move) => (
                    <TableRow
                      key={move.id}
                      className={cn("cursor-pointer border-l-4", ROW_ACCENT[move.direction])}
                      onClick={() => router.push(operationPath(move.type, move.operationId))}
                    >
                      <TableCell className="font-mono text-sm font-semibold">{move.reference}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(move.date)}</TableCell>
                      <TableCell className="hidden max-w-40 truncate xl:table-cell">{move.contact || "—"}</TableCell>
                      <TableCell className="max-w-48">
                        <p className="truncate font-medium">{move.productName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{move.sku}</p>
                      </TableCell>
                      <TableCell className="hidden max-w-44 truncate font-mono text-xs text-muted-foreground md:table-cell">{move.from}</TableCell>
                      <TableCell className="hidden max-w-44 truncate font-mono text-xs text-muted-foreground md:table-cell">{move.to}</TableCell>
                      <TableCell className="text-right">
                        <MoveQuantity direction={move.direction} quantity={move.quantity} uom={move.uom} />
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={move.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {data && <PaginationBar page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />}
          </>
        )}
      </Card>
    </>
  );
}
