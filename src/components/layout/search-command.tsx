"use client";

import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api, qs } from "@/lib/api-client";
import { OPERATION_META, operationPath } from "@/lib/constants";
import { formatQty } from "@/lib/format";
import type { SearchResultsDTO } from "@/lib/types";
import { NAV_GROUPS } from "./nav-config";

/** Global search (Ctrl/Cmd + K): products by name or SKU, operations by reference or contact, pages. */
export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 200);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api<SearchResultsDTO>(`/api/search${qs({ q: debounced })}`),
    enabled: open && debounced.length > 0,
  });

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const pages = NAV_GROUPS.flatMap((group) => group.items).filter((item) =>
    item.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-64 sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="mx-auto sm:mx-0" />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search SKU, product, reference…</span>
        <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search products, operations and pages"
      >
        <CommandInput placeholder="Search SKU, product name, reference or contact…" value={query} onValueChange={setQuery} />
        <CommandList>
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Spinner className="size-3" /> Searching…
            </div>
          )}
          <CommandEmpty>No results found.</CommandEmpty>
          {data?.products.length ? (
            <CommandGroup heading="Products">
              {data.products.map((product) => (
                <CommandItem key={product.id} value={`product-${product.id}`} onSelect={() => go(`/products/${product.id}`)}>
                  <Package />
                  <span className="flex-1 truncate">{product.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                  <span className="text-xs tabular text-muted-foreground">
                    {formatQty(product.onHand)} {product.uom}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {data?.operations.length ? (
            <CommandGroup heading="Operations">
              {data.operations.map((op) => (
                <CommandItem key={op.id} value={`operation-${op.id}`} onSelect={() => go(operationPath(op.type, op.id))}>
                  <span className="font-mono text-xs font-medium">{op.reference}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {OPERATION_META[op.type].label}
                    {op.contact ? ` · ${op.contact}` : ""}
                  </span>
                  <StatusBadge status={op.status} />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {pages.length > 0 && (
            <CommandGroup heading="Pages">
              {pages.map((page) => (
                <CommandItem key={page.href} value={`page-${page.title}`} onSelect={() => go(page.href)}>
                  <page.icon />
                  {page.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
