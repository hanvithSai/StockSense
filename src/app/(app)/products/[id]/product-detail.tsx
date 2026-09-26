"use client";

import { useQuery } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Boxes, History, Pencil, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { EmptyState } from "@/components/common/empty-state";
import { StockBadge } from "@/components/common/stock-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { useSession } from "@/components/layout/session-context";
import { ProductAvatar } from "@/components/products/product-avatar";
import { StockLevelChart } from "@/components/products/stock-level-chart";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { UpdateStockDialog, type StockTarget } from "@/components/stock/update-stock-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { api, ApiError } from "@/lib/api-client";
import { OPERATION_META, operationPath } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatQty } from "@/lib/format";
import type { LedgerRowDTO, ProductRowDTO, ReorderRuleDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ProductDetail({ id }: { id: string }) {
  const { can } = useSession();
  const [editing, setEditing] = useState(false);
  const [stockTarget, setStockTarget] = useState<StockTarget | null>(null);

  const product = useQuery({ queryKey: ["product", id], queryFn: () => api<ProductRowDTO>(`/api/products/${id}`) });
  const ledger = useQuery({ queryKey: ["ledger", id], queryFn: () => api<LedgerRowDTO[]>(`/api/products/${id}/ledger`) });
  const rules = useQuery({ queryKey: ["reorder-rules"], queryFn: () => api<ReorderRuleDTO[]>("/api/reorder-rules") });

  const toggleActive = useApiMutation<boolean, ProductRowDTO>({
    mutationFn: (isActive) => api(`/api/products/${id}`, { method: "PATCH", body: { isActive } }),
    success: (result) => (result.isActive ? "Product restored" : "Product archived"),
  });

  if (product.error instanceof ApiError && product.error.status === 404) notFound();
  const data = product.data;
  const productRules = rules.data?.filter((rule) => rule.product.id === id) ?? [];

  return (
    <>
      <Link href="/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Products
      </Link>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
            <ProductAvatar name={data.name} category={data.category?.name} className="size-14 rounded-xl text-base" />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
                <StockBadge status={data.status} />
                {!data.isActive && <Badge variant="outline">Archived</Badge>}
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{data.sku}</span>
                {data.category?.name} · {data.uom}
                {data.description && ` · ${data.description}`}
              </p>
            </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("stock:move") && data.isActive && (
                <Button
                  variant="outline"
                  onClick={() => setStockTarget({ productId: data.id, productName: data.name, uom: data.uom })}
                >
                  <RefreshCcw /> Update stock
                </Button>
              )}
              {can("master:write") && (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="ghost" onClick={() => toggleActive.mutate(!data.isActive)} disabled={toggleActive.isPending}>
                    {data.isActive ? <Archive /> : <ArchiveRestore />}
                    {data.isActive ? "Archive" : "Restore"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="On hand" value={`${formatQty(data.onHand)} ${data.uom}`} hint="Across all warehouses" />
            <Metric label="Reserved" value={formatQty(data.reserved)} hint="Held by confirmed deliveries/transfers" />
            <Metric label="Free to use" value={formatQty(data.free)} hint="On hand minus reserved" />
            <Metric label="Stock value" value={formatCurrency(data.value)} hint={`${formatCurrency(data.costPrice)} per unit`} />
          </div>

          {ledger.data && ledger.data.length > 1 && (
            <StockLevelChart rows={ledger.data} uom={data.uom} minQty={data.minQty} />
          )}

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="gap-0 pb-0 lg:col-span-3">
              <CardHeader className="border-b pb-4">
                <CardTitle>Stock by location</CardTitle>
                <CardDescription>Where this product is stored right now.</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Free</TableHead>
                    {can("stock:move") && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.locations.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5}>
                        <EmptyState icon={Boxes} title="No stock anywhere" description="Validate a receipt or update the stock to add quantity." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.locations.map((location) => (
                      <TableRow key={location.locationId}>
                        <TableCell className="font-mono text-sm">{location.fullName}</TableCell>
                        <TableCell className="text-right tabular font-medium">{formatQty(location.quantity)}</TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">{formatQty(location.reserved)}</TableCell>
                        <TableCell className="text-right tabular">{formatQty(location.free)}</TableCell>
                        {can("stock:move") && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Update stock at ${location.fullName}`}
                              onClick={() =>
                                setStockTarget({ productId: data.id, productName: data.name, uom: data.uom, locationId: location.locationId })
                              }
                            >
                              <RefreshCcw />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Reordering rules</CardTitle>
                <CardDescription>Alerts trigger when on hand drops to the minimum.</CardDescription>
                <CardAction>
                  <Button variant="link" size="sm" asChild>
                    <Link href="/products/reordering">Manage</Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                {productRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reordering rule. Only out-of-stock alerts apply.</p>
                ) : (
                  productRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{rule.warehouse.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Min {formatQty(rule.minQty)} · Max {formatQty(rule.maxQty)} · On hand {formatQty(rule.onHand)}
                        </p>
                      </div>
                      <StockBadge status={rule.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> Stock ledger
              </CardTitle>
              <CardDescription>Every validated movement of this product with the resulting on-hand balance.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="hidden md:table-cell">From → To</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.isLoading ? (
                  <TableSkeleton columns={5} rows={3} />
                ) : !ledger.data?.length ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No validated movements yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(row.date)}</TableCell>
                      <TableCell>
                        <Link href={operationPath(row.type, row.operationId)} className="font-mono text-sm font-medium hover:underline">
                          {row.reference}
                        </Link>
                        <p className="text-xs text-muted-foreground">{OPERATION_META[row.type].label}</p>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {row.from} → {row.to}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular font-medium",
                          row.change > 0 && "text-emerald-600 dark:text-emerald-400",
                          row.change < 0 && "text-destructive",
                        )}
                      >
                        {row.change > 0 ? "+" : ""}
                        {row.change === 0 ? `${formatQty(row.quantity)} moved` : formatQty(row.change)}
                      </TableCell>
                      <TableCell className="text-right tabular">{formatQty(row.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
          <ActivityTimeline entityType="product" entityId={data.id} className="self-start" />
          </div>

          <ProductFormDialog open={editing} onOpenChange={setEditing} product={data} />
          <UpdateStockDialog target={stockTarget} onClose={() => setStockTarget(null)} />
        </>
      )}
    </>
  );
}
