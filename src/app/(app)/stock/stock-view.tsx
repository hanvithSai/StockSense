"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Boxes, ChevronRight, ClipboardList, Download, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FilterSelect } from "@/components/common/filter-select";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { StockBadge } from "@/components/common/stock-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { useSession } from "@/components/layout/session-context";
import { ProductAvatar } from "@/components/products/product-avatar";
import { CountLocationDialog } from "@/components/stock/count-location-dialog";
import { UpdateStockDialog, type StockTarget } from "@/components/stock/update-stock-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCategories, useLocations, useWarehouses } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import { LIVE_REFRESH_MS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency, formatQty, todayISO } from "@/lib/format";
import type { ProductRowDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StockView() {
  const { can } = useSession();
  const canMove = can("stock:move");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState(searchParams.get("warehouse") ?? "");
  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<StockTarget | null>(null);
  const [counting, setCounting] = useState(false);
  const q = useDebouncedValue(search.trim(), 250);
  const { data: warehouses = [] } = useWarehouses();
  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  const params = { q, warehouse, location, category };
  const { data, isLoading } = useQuery({
    queryKey: ["stock", params],
    queryFn: () => api<ProductRowDTO[]>(`/api/stock${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
  });

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalValue = data?.reduce((total, row) => total + row.value, 0) ?? 0;

  function exportCsv() {
    downloadCsv(
      `stock-${todayISO()}.csv`,
      ["Product", "SKU", "Category", "Unit", "Cost per unit", "On hand", "Reserved", "Free to use", "Incoming", "Outgoing", "Forecast", "Value", "Status"],
      (data ?? []).map((row) => [
        row.name,
        row.sku,
        row.category?.name,
        row.uom,
        row.costPrice,
        row.onHand,
        row.reserved,
        row.free,
        row.incoming,
        row.outgoing,
        row.forecast,
        row.value,
        row.status,
      ]),
    );
  }
  const locationOptions = locations
    .filter((item) => !warehouse || item.warehouse?.id === warehouse)
    .map((item) => ({ value: item.id, label: item.fullName }));

  return (
    <>
      <PageHeader
        title="Stock"
        description="Available stock per product and location. Update counts directly from here; every change is logged."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!data?.length}>
              <Download /> Export CSV
            </Button>
            {canMove && (
              <Button variant="outline" onClick={() => setCounting(true)}>
                <ClipboardList /> Count location
              </Button>
            )}
          </>
        }
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU…" />
          <FilterSelect
            value={warehouse}
            onChange={(value) => {
              setWarehouse(value);
              setLocation("");
            }}
            allLabel="All warehouses"
            options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <FilterSelect value={location} onChange={setLocation} allLabel="All locations" options={locationOptions} />
          <FilterSelect
            value={category}
            onChange={setCategory}
            allLabel="All categories"
            options={categories.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Product</TableHead>
              <TableHead className="hidden text-right md:table-cell">Per unit cost</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Free to use</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Forecast</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Value</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Status</TableHead>
              {canMove && <TableHead className="w-28 text-right">Update</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={8} />
            ) : !data?.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8}>
                  <EmptyState icon={Boxes} title="No products found" description="Adjust the filters or add products first." />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const isOpen = expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(row.id)} data-state={isOpen ? "selected" : undefined}>
                      <TableCell>
                        <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ProductAvatar name={row.name} category={row.category?.name} />
                          <div className="min-w-0">
                            <Link
                              href={`/products/${row.id}`}
                              onClick={(event) => event.stopPropagation()}
                              className="block truncate font-medium hover:underline"
                            >
                              {row.name}
                            </Link>
                            <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right tabular md:table-cell">{formatCurrency(row.costPrice)}</TableCell>
                      <TableCell className="text-right tabular font-medium">
                        {formatQty(row.onHand)} <span className="text-xs font-normal text-muted-foreground">{row.uom}</span>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatQty(row.free)}
                        {row.reserved > 0 && <p className="text-xs text-muted-foreground">{formatQty(row.reserved)} reserved</p>}
                      </TableCell>
                      <TableCell className="hidden text-right tabular xl:table-cell">
                        {formatQty(row.forecast)}
                        {(row.incoming > 0 || row.outgoing > 0) && (
                          <p className="text-xs text-muted-foreground">
                            {row.incoming > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{formatQty(row.incoming)}</span>}
                            {row.incoming > 0 && row.outgoing > 0 && " · "}
                            {row.outgoing > 0 && <span className="text-destructive">−{formatQty(row.outgoing)}</span>}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right tabular lg:table-cell">{formatCurrency(row.value)}</TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <StockBadge status={row.status} />
                      </TableCell>
                      {canMove && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setTarget({ productId: row.id, productName: row.name, uom: row.uom, locationId: location || undefined });
                            }}
                          >
                            <RefreshCcw /> Update
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={7} className="py-3">
                          {row.locations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No stock in the selected scope.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {row.locations.map((item) => (
                                <div key={item.locationId} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                                  <div>
                                    <p className="font-mono text-sm">{item.fullName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatQty(item.quantity)} on hand · {formatQty(item.free)} free
                                    </p>
                                  </div>
                                  {canMove && (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Update ${row.name} at ${item.fullName}`}
                                      onClick={() => setTarget({ productId: row.id, productName: row.name, uom: row.uom, locationId: item.locationId })}
                                    >
                                      <RefreshCcw />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
          {data && data.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  {data.length} products
                </TableCell>
                <TableCell className="hidden xl:table-cell" />
                <TableCell className="hidden text-right tabular font-semibold lg:table-cell">{formatCurrency(totalValue)}</TableCell>
                <TableCell colSpan={2} className="hidden sm:table-cell" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>

      <UpdateStockDialog target={target} onClose={() => setTarget(null)} />
      <CountLocationDialog open={counting} onOpenChange={setCounting} defaultLocation={location} />
    </>
  );
}
