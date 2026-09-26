"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Inbox, Plus, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FilterSelect } from "@/components/common/filter-select";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { ViewToggle, type ViewMode } from "@/components/common/view-toggle";
import { useSession } from "@/components/layout/session-context";
import { OperationKanban } from "@/components/operations/operation-kanban";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useWarehouses } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import {
  LIVE_REFRESH_MS,
  OPERATION_META,
  OPERATION_STATUSES,
  operationPath,
  STATUS_LABELS,
  type OperationStatus,
  type OperationType,
} from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/format";
import { manageCapability } from "@/lib/permissions";
import type { OperationListDTO, OperationListItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const DESCRIPTIONS: Record<OperationType, string> = {
  receipt: "Incoming goods from vendors. Validating a receipt increases stock automatically.",
  delivery: "Outgoing shipments to customers: pick, pack and validate to decrease stock.",
  internal: "Stock moved between locations or warehouses. Every move is logged in the ledger.",
  adjustment: "Physical counts that correct recorded stock, with the difference logged.",
};

function ScheduleCell({ item }: { item: OperationListItemDTO }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", item.isLate && "font-medium text-destructive")}>
      {item.isLate && <TriangleAlert className="size-3.5" />}
      {formatDate(item.scheduledDate)}
    </span>
  );
}

export function OperationList({ type }: { type: OperationType }) {
  const router = useRouter();
  const { can, user } = useSession();
  const meta = OPERATION_META[type];
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as OperationStatus | null;
  const [view, setView] = useState<ViewMode>(searchParams.get("view") === "kanban" ? "kanban" : "list");
  const [mine, setMine] = useState(searchParams.get("mine") === "1");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState<OperationStatus | "">(initialStatus && OPERATION_STATUSES.includes(initialStatus) ? initialStatus : "");
  const [warehouse, setWarehouse] = useState(searchParams.get("warehouse") ?? "");
  const [late, setLate] = useState(searchParams.get("late") === "1");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 250);
  const { data: warehouses = [] } = useWarehouses();

  const kanban = view === "kanban";
  const params = {
    type,
    q,
    warehouse,
    status: kanban ? "" : status,
    late: late ? 1 : "",
    responsible: mine ? user.id : "",
    today: todayISO(),
    page: kanban ? 1 : page,
    limit: kanban ? 200 : 20,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["operations", params],
    queryFn: () => api<OperationListDTO>(`/api/operations${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const statuses: OperationStatus[] = [...meta.flow, "cancelled"];
  const total = Object.values(data?.statusCounts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0);
  const isAdjustment = type === "adjustment";
  const columnCount = isAdjustment ? 5 : 6;

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title={meta.plural}
        description={DESCRIPTIONS[type]}
        actions={
          can(manageCapability(type)) && (
            <Button asChild>
              <Link href={`${operationPath(type)}/new`}>
                <Plus /> New
              </Link>
            </Button>
          )
        }
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search reference, contact or product…" />
          <FilterSelect
            value={warehouse}
            onChange={reset(setWarehouse)}
            allLabel="All warehouses"
            options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <Toggle
            variant="outline"
            pressed={late}
            onPressedChange={reset(setLate)}
            className="h-9 data-[state=on]:border-destructive/40 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
            aria-label="Show late operations only"
          >
            <TriangleAlert /> Late
          </Toggle>
          <Toggle
            variant="outline"
            pressed={mine}
            onPressedChange={reset(setMine)}
            className="h-9 data-[state=on]:border-primary/40 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
            aria-label="Show operations assigned to me"
          >
            <UserRound /> Assigned to me
          </Toggle>
          <div className="ml-auto">
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>

        {!kanban && (
          <div className="flex gap-1.5 overflow-x-auto border-b px-3 py-2">
            {(["", ...statuses] as const).map((value) => {
              const count = value ? (data?.statusCounts[value] ?? 0) : total;
              return (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => reset(setStatus)(value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors",
                    status === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {value ? STATUS_LABELS[value] : "All"}
                  <span className={cn("text-xs tabular", status === value ? "opacity-80" : "opacity-60")}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {kanban ? (
          isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <OperationKanban type={type} items={data?.items ?? []} />
          )
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  {isAdjustment ? (
                    <>
                      <TableHead>Location</TableHead>
                      <TableHead className="hidden md:table-cell">Products</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="hidden md:table-cell">From</TableHead>
                      <TableHead className="hidden md:table-cell">To</TableHead>
                      <TableHead>{type === "internal" ? "Products" : "Contact"}</TableHead>
                    </>
                  )}
                  <TableHead>Schedule date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columns={columnCount} />
                ) : !data?.items.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columnCount}>
                      <EmptyState
                        icon={Inbox}
                        title={`No ${meta.plural.toLowerCase()} found`}
                        description={q || status || late ? "Try clearing the filters." : `Create your first ${meta.label.toLowerCase()}.`}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(operationPath(type, item.id))}>
                      <TableCell className="font-mono text-sm font-semibold">{item.reference}</TableCell>
                      {isAdjustment ? (
                        <>
                          <TableCell className="font-mono text-sm">{item.destName}</TableCell>
                          <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{item.productSummary}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="hidden font-mono text-sm text-muted-foreground md:table-cell">{item.sourceName}</TableCell>
                          <TableCell className="hidden font-mono text-sm text-muted-foreground md:table-cell">{item.destName}</TableCell>
                          <TableCell className="max-w-56 truncate">{type === "internal" ? item.productSummary : item.contact}</TableCell>
                        </>
                      )}
                      <TableCell>
                        <ScheduleCell item={item} />
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={item.status} />
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
