"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowDownToLine,
  CalendarClock,
  Download,
  Gauge,
  PackageSearch,
  Timer,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from "recharts";
import { FilterSelect } from "@/components/common/filter-select";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useWarehouses } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import { OPERATION_META, STATUS_LABELS, type OperationStatus } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { formatCompact, formatCurrency, formatDate, formatQty, parseISODate, todayISO } from "@/lib/format";
import type { ReportDTO } from "@/lib/types";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.62 0.12 150)",
  "oklch(0.58 0.09 285)",
];

const STATUS_COLORS: Record<OperationStatus, string> = {
  draft: "oklch(0.72 0.02 300)",
  waiting: "var(--warning)",
  ready: "var(--info)",
  done: "var(--success)",
  cancelled: "var(--destructive)",
};

const movementConfig = {
  valueIn: { label: "Received", color: "var(--chart-2)" },
  valueOut: { label: "Shipped", color: "var(--chart-1)" },
} satisfies ChartConfig;

const statusConfig = Object.fromEntries(
  (Object.keys(STATUS_COLORS) as OperationStatus[]).map((status) => [status, { label: STATUS_LABELS[status], color: STATUS_COLORS[status] }]),
) satisfies ChartConfig;

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: LucideIcon }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function CurrencyTooltip({ labelFormatter }: { labelFormatter?: (label: string) => string }) {
  return (
    <ChartTooltipContent
      indicator="dot"
      labelFormatter={labelFormatter ? (label) => labelFormatter(String(label)) : undefined}
      formatter={(value, name, item) => (
        <div className="flex w-full items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: item.color ?? item.payload?.fill }} />
            {movementConfig[name as keyof typeof movementConfig]?.label ?? name}
          </span>
          <span className="font-mono font-medium text-foreground tabular">{formatCurrency(Number(value))}</span>
        </div>
      )}
    />
  );
}

export function ReportsView() {
  const [days, setDays] = useState("30");
  const [warehouse, setWarehouse] = useState("");
  const { data: warehouses = [] } = useWarehouses();

  const params = { days, warehouse, today: todayISO(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const { data } = useQuery({
    queryKey: ["reports", params],
    queryFn: () => api<ReportDTO>(`/api/reports${qs(params)}`),
    placeholderData: keepPreviousData,
  });

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `stock-movement-${days}d-${todayISO()}.csv`,
      ["Date", "Received value", "Shipped value", "Receipts", "Deliveries"],
      data.movement.map((point) => [point.date, point.valueIn, point.valueOut, point.receipts, point.deliveries]),
    );
  }

  const summary = data?.summary;
  const categories = (data?.valueByCategory ?? []).map((item, index) => ({ ...item, fill: PALETTE[index % PALETTE.length] }));
  const categoryConfig = Object.fromEntries(categories.map((item) => [item.name, { label: item.name, color: item.fill }])) satisfies ChartConfig;
  const categoryTotal = categories.reduce((total, item) => total + item.value, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Valuation, stock movement, service level and product velocity across your warehouses."
        actions={
          <>
            <ToggleGroup type="single" variant="outline" value={days} onValueChange={(value) => value && setDays(value)} aria-label="Period">
              {["7", "30", "90"].map((value) => (
                <ToggleGroupItem key={value} value={value} className="h-9 px-3">
                  {value}d
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FilterSelect
              value={warehouse}
              onChange={setWarehouse}
              allLabel="All warehouses"
              options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
            />
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download /> Export
            </Button>
          </>
        }
      />

      {!summary || !data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Kpi label="Stock value" value={`₹${formatCompact(summary.stockValue)}`} hint="Current valuation at cost" icon={Wallet} />
            <Kpi label="Goods received" value={`₹${formatCompact(summary.valueIn)}`} hint={`Last ${data.days} days`} icon={ArrowDownToLine} />
            <Kpi label="Goods shipped" value={`₹${formatCompact(summary.valueOut)}`} hint={`${summary.operationsDone} operations validated`} icon={Truck} />
            <Kpi
              label="On-time rate"
              value={summary.onTimeRate === null ? "—" : `${Math.round(summary.onTimeRate * 100)}%`}
              hint="Validated by the scheduled date"
              icon={CalendarClock}
            />
            <Kpi
              label="Delivery lead time"
              value={summary.avgDeliveryHours === null ? "—" : `${summary.avgDeliveryHours.toFixed(1)} h`}
              hint="Order created to shipped"
              icon={Timer}
            />
            <Kpi
              label="Days of cover"
              value={summary.daysOfCover === null ? "—" : `${Math.round(summary.daysOfCover)}`}
              hint={summary.turnover === null ? "At current shipping rate" : `Turnover ${summary.turnover.toFixed(2)}× in period`}
              icon={Gauge}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Stock movement value</CardTitle>
                <CardDescription>Goods received vs shipped per day, valued at cost</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={movementConfig} className="aspect-auto h-80 w-full">
                  <AreaChart data={data.movement} margin={{ left: 4, right: 12, top: 8 }}>
                    <defs>
                      <linearGradient id="fill-in" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-valueIn)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-valueIn)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="fill-out" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-valueOut)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-valueOut)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={28}
                      tickFormatter={(value: string) => format(parseISODate(value), "d MMM")}
                    />
                    <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value: number) => `₹${formatCompact(value)}`} />
                    <ChartTooltip cursor={false} content={<CurrencyTooltip labelFormatter={formatDate} />} />
                    <Area dataKey="valueIn" type="monotone" fill="url(#fill-in)" stroke="var(--color-valueIn)" strokeWidth={2} />
                    <Area dataKey="valueOut" type="monotone" fill="url(#fill-out)" stroke="var(--color-valueOut)" strokeWidth={2} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Value by category</CardTitle>
                <CardDescription>Where your inventory money sits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChartContainer config={categoryConfig} className="mx-auto aspect-square h-52">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          nameKey="name"
                          formatter={(value, name) => (
                            <div className="flex w-full justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-mono font-medium tabular">{formatCurrency(Number(value))}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} strokeWidth={3} paddingAngle={1} />
                  </PieChart>
                </ChartContainer>
                <ul className="space-y-1.5 text-sm">
                  {categories.map((item) => (
                    <li key={item.name} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 truncate">
                        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: item.fill }} />
                        {item.name}
                      </span>
                      <span className="text-muted-foreground tabular">
                        {categoryTotal ? Math.round((item.value / categoryTotal) * 100) : 0}% · ₹{formatCompact(item.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Top products shipped</CardTitle>
                <CardDescription>By value delivered in the last {data.days} days</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No deliveries in this period.</p>
                ) : (
                  <ChartContainer config={{ value: { label: "Shipped value", color: "var(--chart-1)" } }} className="aspect-auto h-72 w-full">
                    <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value: number) => `₹${formatCompact(value)}`} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={130} tickMargin={4} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => (
                              <div className="flex w-full justify-between gap-4">
                                <span className="text-muted-foreground">
                                  {formatQty(item.payload.quantity)} {item.payload.uom}
                                </span>
                                <span className="font-mono font-medium tabular">{formatCurrency(Number(value))}</span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Value by warehouse</CardTitle>
                <CardDescription>Current stock valuation per site</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ value: { label: "Stock value", color: "var(--chart-2)" } }} className="aspect-auto h-72 w-full">
                  <BarChart data={data.valueByWarehouse} margin={{ top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="code" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value: number) => `₹${formatCompact(value)}`} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_label, payload) => payload?.[0]?.payload?.name ?? ""}
                          formatter={(value) => (
                            <span className="font-mono font-medium tabular">{formatCurrency(Number(value))}</span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} barSize={42} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Operations by status</CardTitle>
                <CardDescription>All operations in scope, grouped by type</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={statusConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={data.statusByType.map((row) => ({ ...row, label: OPERATION_META[row.type].plural.replace("Inventory ", "") }))}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {(Object.keys(STATUS_COLORS) as OperationStatus[]).map((status, index, all) => (
                      <Bar
                        key={status}
                        dataKey={status}
                        stackId="status"
                        fill={`var(--color-${status})`}
                        radius={index === all.length - 1 ? [6, 6, 0, 0] : 0}
                        barSize={44}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="gap-0 pb-0">
              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2">
                  <PackageSearch className="size-4" /> Slow movers
                </CardTitle>
                <CardDescription>Stocked products with no deliveries in the last {data.days} days</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Tied-up value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slowMovers.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        Every stocked product moved in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.slowMovers.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Link href={`/products/${item.id}`} className="font-medium hover:underline">
                            {item.name}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {formatQty(item.onHand)} <span className="text-xs text-muted-foreground">{item.uom}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular">{formatCurrency(item.value)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
