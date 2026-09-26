"use client";

import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatQty } from "@/lib/format";
import type { ProductOptionDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductPickerProps {
  value: string;
  onChange: (productId: string) => void;
  products: ProductOptionDTO[];
  disabled?: boolean;
  invalid?: boolean;
  /** Products already used on other lines (hidden from the list). */
  exclude?: string[];
  fallbackLabel?: string;
}

/** Searchable product combobox showing `[SKU] Name` and stock on hand. */
export function ProductPicker({ value, onChange, products, disabled, invalid, exclude = [], fallbackLabel }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => product.id === value);
  const label = selected ? `[${selected.sku}] ${selected.name}` : fallbackLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Product"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn("h-9 w-full min-w-48 justify-between font-normal", !label && "text-muted-foreground")}
        >
          <span className="truncate">{label ?? "Select a product…"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="@container w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search by name or SKU…" />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {products
                .filter((product) => product.id === value || !exclude.includes(product.id))
                .map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`${product.sku} ${product.name}`}
                    data-checked={product.id === value}
                    onSelect={() => {
                      onChange(product.id);
                      setOpen(false);
                    }}
                  >
                    {/* One line in wide lists; in narrow ones (phones) the name gets its own line under SKU and stock. */}
                    <span className="flex min-w-0 flex-1 flex-col @xs:flex-row @xs:items-baseline @xs:gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        [{product.sku}]
                        <span className="font-sans tabular @xs:hidden">
                          {" "}
                          · {formatQty(product.onHand)} {product.uom}
                        </span>
                      </span>
                      <span className="truncate">{product.name}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular @xs:inline">
                      {formatQty(product.onHand)} {product.uom}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
