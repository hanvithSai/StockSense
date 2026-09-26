"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Barcode } from "@/components/products/barcode";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import type { ProductRowDTO } from "@/lib/types";

const COPY_OPTIONS = [6, 12, 24, 36];

/** A4 sheet of product labels (name, category and SKU barcode), ready for a label printer. */
export function LabelSheet({ id, copies }: { id: string; copies: number }) {
  const router = useRouter();
  const { data: product, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductRowDTO>(`/api/products/${id}`),
  });

  if (error) return <p className="p-10 text-center text-sm text-red-600">This product could not be loaded.</p>;
  if (!product) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-neutral-100 py-8 text-neutral-900 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <p className="font-semibold">Barcode labels · {product.name}</p>
          <p className="text-sm text-neutral-500">Scan these labels in any operation to add the product instantly.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={copies}
            onChange={(event) => router.replace(`/print/labels/${id}?copies=${event.target.value}`)}
            className="h-9 rounded-md border bg-white px-2 text-sm"
            aria-label="Number of labels"
          >
            {COPY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} labels
              </option>
            ))}
          </select>
          <Button onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </div>
      </div>
      <div className="mx-auto grid max-w-4xl grid-cols-3 gap-3 bg-white p-6 shadow-sm print:max-w-none print:gap-2 print:p-0 print:shadow-none">
        {Array.from({ length: copies }, (_, index) => (
          <div key={index} className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 px-3 py-3 text-center break-inside-avoid">
            <p className="w-full truncate text-sm font-semibold">{product.name}</p>
            <p className="text-[10px] tracking-wide text-neutral-500 uppercase">{product.category?.name}</p>
            <Barcode value={product.sku} className="h-16 w-full max-w-[180px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
