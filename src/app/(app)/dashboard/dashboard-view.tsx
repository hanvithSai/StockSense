"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CircleCheck,
  Hourglass,
  PackageX,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilterSelect } from "@/components/common/filter-select";
import { MoveQuantity } from "@/components/common/move-quantity";
import { StatusBadge } from "@/components/common/status-badge";
import { StockBadge } from "@/components/common/stock-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { useSession } from "@/components/layout/session-context";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories, useLocations, useWarehouses } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import {
  LIVE_REFRESH_MS,
  OPERATION_META,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  operationPath,
  STATUS_LABELS,
  type OperationType,
} from "@/lib/constants";
import { formatCompact, formatDate, formatRelative, todayISO } from "@/lib/format";
import type { DashboardDTO, OperationListDTO, OperationTypeStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOC_TYPE_TABS: Record<OperationType, string> = {
  receipt: "Receipts",
  delivery: "Delivery",
  internal: "Internal",
  adjustment: "Adjustments",
};

interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  icon: LucideIcon;
  tone: string;
  href: string;
}

function Kpi({ label, value, hint, icon: Icon, tone, href }: KpiProps) {
  return (
    <Link href={href} className="group">
      <Card className="h-full gap-3 py-4 transition group-hover:border-primary/30 group-hover:shadow-sm">
        <CardContent className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tracking-tight tabular">{value}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
            <Icon className="size-5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function OperationCard({
  type,
  stats,
  icon: Icon,
  actionLabel,
}: {
  type: OperationType;
  stats: OperationTypeStats;
  icon: LucideIcon;
  actionLabel: string;
}) {
  const meta = OPERATION_META[type];
  const base = operationPath(type);
  const items = [
    { label: "Late", value: stats.late, tone: stats.late ? "text-destructive" : "", icon: TriangleAlert },
    ...(type !== "receipt" ? [{ label: "Waiting", value: stats.waiting, tone: stats.waiting ? "text-amber-600 dark:text-amber-400" : "", icon: Hourglass }] : []),
    { label: "Upcoming", value: stats.upcoming, tone: "", icon: ArrowRight },
  ];
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          {meta.label === "Delivery Order" ? "Delivery" : meta.label}
        </CardTitle>
        <CardDescription>{stats.open} open operation{stats.open === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild size="lg" className="h-11 px-4 text-base">
          <Link href={base}>
            <span className="tabular">{stats.ready}</span> {actionLabel}
          </Link>
        </Button>
        <dl className="flex gap-5 text-sm">
          {items.map((item) => (
            <div key={item.label} className="text-right">
              <dt className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <item.icon className="size-3" /> {item.label}
              </dt>
              <dd className={cn("text-lg font-semibold tabular", item.tone)}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const router = useRouter();
  const { user } = useSession();
  const [warehouse, setWarehouse] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [docType, setDocType] = useState<OperationType | "all">("all");
  const [status, setStatus] = useState("");
  const { data: warehouses = [] } = useWarehouses();
  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  const scope = { warehouse, location, category, today: todayISO() };
  const { data } = useQuery({
    queryKey: ["dashboard", scope],
    queryFn: () => api<DashboardDTO>(`/api/dashboard${qs(scope)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const listParams = { ...scope, type: docType === "all" ? "" : docType, status, limit: 8 };
  const operations = useQuery({
    queryKey: ["operations", "dashboard", listParams],
    queryFn: () => api<OperationListDTO>(`/api/operations${qs(listParams)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const kpis = data?.kpis;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground">Snapshot of your inventory operations, refreshed live.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            value={warehouse}
            onChange={(value) => {
              setWarehouse(value);
              setLocation("");
            }}
            allLabel="All warehouses"
            options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <FilterSelect
            value={location}
            onChange={setLocation}
            allLabel="All locations"
            options={locations
              .filter((item) => !warehouse || item.warehouse?.id === warehouse)
              .map((item) => ({ value: item.id, label: item.fullName }))}
          />
          <FilterSelect
            value={category}
            onChange={setCategory}
            allLabel="All categories"
            options={categories.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
      </div>

      {!kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5 [&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
          <Kpi
            label="Products in stock"
            value={kpis.productsInStock}
            hint={`of ${kpis.totalProducts} · ₹${formatCompact(kpis.stockValue)} value`}
            icon={Boxes}
            tone="bg-primary/10 text-primary"
            href="/stock"
          />
          <Kpi
            label="Low / out of stock"
            value={
              <>
                <span className="text-amber-600 dark:text-amber-400">{kpis.lowStock}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive">{kpis.outOfStock}</span>
              </>
            }
            hint="At reorder minimum / empty"
            icon={PackageX}
            tone="bg-destructive/10 text-destructive"
            href="/products/reordering"
          />
          <Kpi
            label="Pending receipts"
            value={kpis.pendingReceipts}
            hint={`${data.operations.receipt.ready} ready to receive`}
            icon={ArrowDownToLine}
            tone="bg-success/12 text-emerald-600 dark:text-emerald-400"
            href="/operations/receipts"
          />
          <Kpi
            label="Pending deliveries"
            value={kpis.pendingDeliveries}
            hint={`${data.operations.delivery.waiting} waiting for stock`}
            icon={Truck}
            tone="bg-warning/15 text-amber-600 dark:text-amber-400"
            href="/operations/deliveries"
          />
          <Kpi
            label="Transfers scheduled"
            value={kpis.scheduledTransfers}
            hint={`${data.operations.internal.ready} ready to move`}
            icon={ArrowLeftRight}
            tone="bg-info/12 text-sky-600 dark:text-sky-400"
            href="/operations/transfers"
          />
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <OperationCard type="receipt" stats={data.operations.receipt} icon={ArrowDownToLine} actionLabel="to receive" />
          <OperationCard type="delivery" stats={data.operations.delivery} icon={Truck} actionLabel="to deliver" />
          <OperationCard type="internal" stats={data.operations.internal} icon={ArrowLeftRight} actionLabel="to move" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="gap-0 pb-0 xl:col-span-2">
          <CardHeader className="gap-3 border-b pb-4">
            <CardTitle>Operations</CardTitle>
            <CardDescription>Filter by document type, status, warehouse, location or category.</CardDescription>
            <CardAction>
              <FilterSelect
                value={status}
                onChange={setStatus}
                allLabel="All statuses"
                options={OPERATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
                className="sm:w-36"
              />
            </CardAction>
            <Tabs value={docType} onValueChange={(value) => setDocType(value as OperationType | "all")}>
              <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                {OPERATION_TYPES.map((type) => (
                  <TabsTrigger key={type} value={type}>
                    {DOC_TYPE_TABS[type]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Contact / Products</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operations.isLoading ? (
                <TableSkeleton columns={5} rows={4} />
              ) : !operations.data?.items.length ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No operations match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                operations.data.items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(operationPath(item.type, item.id))}>
                    <TableCell className="font-mono text-sm font-semibold">{item.reference}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{OPERATION_META[item.type].label}</TableCell>
                    <TableCell className="hidden max-w-56 truncate md:table-cell">{item.contact || item.productSummary}</TableCell>
                    <TableCell className={cn("whitespace-nowrap text-sm", item.isLate && "font-medium text-destructive")}>
                      {item.isLate && <TriangleAlert className="mr-1 inline size-3.5" />}
                      {formatDate(item.scheduledDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={item.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-amber-500" /> Low stock alerts
              </CardTitle>
              <CardAction>
                <Button variant="link" size="sm" asChild>
                  <Link href="/products/reordering">Rules</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {!data ? (
                <Skeleton className="h-24" />
              ) : data.alerts.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CircleCheck className="size-4 text-success" /> All products are above their reorder levels.
                </p>
              ) : (
                data.alerts.map((item) => (
                  <Link
                    key={item.id}
                    href={`/products/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition hover:border-primary/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        {item.onHand} {item.uom} on hand{item.minQty !== null && ` · min ${item.minQty}`}
                      </p>
                    </div>
                    <StockBadge status={item.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent moves</CardTitle>
              <CardAction>
                <Button variant="link" size="sm" asChild>
                  <Link href="/move-history">View all</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data ? (
                <Skeleton className="h-24" />
              ) : data.recentMoves.length === 0 ? (
                <p className="text-sm text-muted-foreground">No validated moves yet.</p>
              ) : (
                data.recentMoves.map((move) => (
                  <Link key={move.id} href={operationPath(move.type, move.operationId)} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{move.productName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{move.reference}</span> · {formatRelative(move.date)}
                      </p>
                    </div>
                    <MoveQuantity direction={move.direction} quantity={move.quantity} uom={move.uom} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
