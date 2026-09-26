"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Package, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FilterSelect } from "@/components/common/filter-select";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { SearchInput } from "@/components/common/search-input";
import { StockBadge } from "@/components/common/stock-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { useSession } from "@/components/layout/session-context";
import { ImportProductsDialog } from "@/components/products/import-products-dialog";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCategories, useWarehouses } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import { formatCurrency, formatQty } from "@/lib/format";
import type { Paginated, ProductRowDTO } from "@/lib/types";

const STOCK_FILTERS = [
  { value: "ok", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

export function ProductsView() {
  const router = useRouter();
  const { can } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [stock, setStock] = useState("");
  const [archived, setArchived] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const q = useDebouncedValue(search.trim(), 250);
  const { data: categories = [] } = useCategories();
  const { data: warehouses = [] } = useWarehouses();

  const params = { q, category, warehouse, stock, archived, page, limit: 25 };
  const { data, isLoading } = useQuery({
    queryKey: ["products", params],
    queryFn: () => api<Paginated<ProductRowDTO>>(`/api/products${qs(params)}`),
    placeholderData: keepPreviousData,
  });

  const withReset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalog with live stock per warehouse, SKU search and smart filters."
        actions={
          can("master:write") && (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}>
                <Upload /> Import CSV
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus /> New product
              </Button>
            </>
          )
        }
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <SearchInput value={search} onChange={withReset(setSearch)} placeholder="Search name or SKU…" />
          <FilterSelect
            value={category}
            onChange={withReset(setCategory)}
            allLabel="All categories"
            options={categories.map((item) => ({ value: item.id, label: item.name }))}
          />
          <FilterSelect
            value={warehouse}
            onChange={withReset(setWarehouse)}
            allLabel="All warehouses"
            options={warehouses.map((item) => ({ value: item.id, label: item.name }))}
          />
          <FilterSelect value={stock} onChange={withReset(setStock)} allLabel="Any stock level" options={STOCK_FILTERS} />
          <FilterSelect
            value={archived}
            onChange={withReset(setArchived)}
            allLabel="Active products"
            options={[{ value: "1", label: "Archived products" }]}
            className="sm:w-40"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Cost / unit</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Free to use</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={6} />
            ) : !data?.items.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={Package}
                    title={q || category || stock ? "No products match your filters" : "No products yet"}
                    description="Products are the items you receive, store and deliver."
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((product) => (
                <TableRow key={product.id} className="cursor-pointer" onClick={() => router.push(`/products/${product.id}`)}>
                  <TableCell>
                    <p className="font-medium">{product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{product.category?.name ?? "—"}</TableCell>
                  <TableCell className="hidden text-right tabular lg:table-cell">{formatCurrency(product.costPrice)}</TableCell>
                  <TableCell className="text-right tabular font-medium">
                    {formatQty(product.onHand)} <span className="text-xs font-normal text-muted-foreground">{product.uom}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{formatQty(product.free)}</TableCell>
                  <TableCell className="text-right">
                    <StockBadge status={product.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data && <PaginationBar page={data.page} limit={data.limit} total={data.total} onPageChange={setPage} />}
      </Card>

      <ProductFormDialog open={creating} onOpenChange={setCreating} product={null} />
      <ImportProductsDialog open={importing} onOpenChange={setImporting} />
    </>
  );
}
