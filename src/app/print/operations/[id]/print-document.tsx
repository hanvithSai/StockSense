"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Logo } from "@/components/brand/logo";
import { Barcode } from "@/components/products/barcode";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import { OPERATION_META, STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OperationDTO } from "@/lib/types";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}

/** Box to tick or fill in by hand on the printed sheet. */
function HandBox({ checked = false, className }: { checked?: boolean; className?: string }) {
  return (
    <span
      className={cn("ml-auto flex items-center justify-center rounded border border-neutral-400 text-xs", className)}
      aria-hidden
    >
      {checked ? "✓" : ""}
    </span>
  );
}

/** Printable delivery slip / goods received note, picking list (ready moves) or blind count sheet (draft counts). */
export function PrintDocument({ id }: { id: string }) {
  const { data: op, error } = useQuery({
    queryKey: ["operation", id],
    queryFn: () => api<OperationDTO>(`/api/operations/${id}`),
  });

  useEffect(() => {
    if (op) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [op]);

  if (error) return <p className="p-10 text-center text-sm text-red-600">This document could not be loaded.</p>;
  if (!op) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const meta = OPERATION_META[op.type];
  const isAdjustment = op.type === "adjustment";
  // A draft adjustment prints as a blind count sheet: recorded stock stays hidden from the counter.
  const countSheet = isAdjustment && op.status === "draft";
  // A ready delivery or transfer prints as a picking list to tick off along the shelves.
  const pickingList = (op.type === "delivery" || op.type === "internal") && op.status === "ready";
  const title = countSheet ? "Stock count sheet" : pickingList ? "Picking list" : meta.label;
  const handSheet = countSheet || pickingList;

  return (
    <div className="min-h-svh bg-neutral-100 py-8 text-neutral-900 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end px-4">
        <Button onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>
      <article className="mx-auto max-w-3xl bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b pb-6">
          <div className="space-y-2">
            <Logo />
            <p className="text-sm text-neutral-500">{op.warehouse.name}</p>
          </div>
          <div className="flex flex-col items-end text-right">
            <p className="text-xs tracking-wide text-neutral-500 uppercase">{title}</p>
            <p className="font-mono text-2xl font-semibold">{op.reference}</p>
            <p className="mt-1 text-sm">{STATUS_LABELS[op.status]}</p>
            <Barcode value={op.reference} className="mt-2 h-12 w-44" />
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 py-6 text-sm sm:grid-cols-3">
          {op.contact && <Detail label={op.type === "receipt" ? "Received from" : "Customer"} value={op.contact} />}
          {op.deliveryAddress && <Detail label="Delivery address" value={op.deliveryAddress} />}
          {countSheet ? (
            <Detail label="Location to count" value={op.destLocation.fullName} />
          ) : (
            <>
              <Detail label={pickingList ? "Pick from" : "From"} value={op.sourceLocation.fullName} />
              <Detail label="To" value={op.destLocation.fullName} />
            </>
          )}
          <Detail label={countSheet ? "Count date" : "Scheduled"} value={formatDate(op.scheduledDate)} />
          {!handSheet && <Detail label="Validated" value={op.doneAt ? formatDateTime(op.doneAt) : "Not validated"} />}
          <Detail label="Responsible" value={op.responsible?.name} />
        </dl>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y bg-neutral-50 text-left">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Product</th>
              {isAdjustment && !countSheet && <th className="px-3 py-2 text-right font-semibold">Recorded</th>}
              <th className="px-3 py-2 text-right font-semibold">{isAdjustment ? "Counted" : "Quantity"}</th>
              {isAdjustment && !countSheet && <th className="px-3 py-2 text-right font-semibold">Difference</th>}
              <th className="px-3 py-2 font-semibold">Unit</th>
              {pickingList && <th className="px-3 py-2 text-right font-semibold">Picked</th>}
              {handSheet && <th className="px-3 py-2 font-semibold">Remarks</th>}
            </tr>
          </thead>
          <tbody>
            {op.lines.map((line, index) => (
              <tr key={line.id} className="border-b">
                <td className="px-3 py-2 text-neutral-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-neutral-500">[{line.sku}]</span> {line.productName}
                </td>
                {isAdjustment && !countSheet && <td className="px-3 py-2 text-right tabular">{formatQty(line.systemQty)}</td>}
                {countSheet ? (
                  <td className="px-3 py-3">
                    <HandBox className="h-7 w-24" />
                  </td>
                ) : (
                  <td className="px-3 py-2 text-right font-medium tabular">{formatQty(line.quantity)}</td>
                )}
                {isAdjustment && !countSheet && (
                  <td className="px-3 py-2 text-right tabular">
                    {line.delta !== null && line.delta > 0 ? "+" : ""}
                    {formatQty(line.delta)}
                  </td>
                )}
                <td className="px-3 py-2">{line.uom}</td>
                {pickingList && (
                  <td className="px-3 py-3">
                    <HandBox checked={line.picked} className="size-6" />
                  </td>
                )}
                {handSheet && (
                  <td className="px-3 py-3">
                    <span className="block h-7 w-full border-b border-neutral-300" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {op.notes && (
          <p className="mt-6 text-sm">
            <span className="font-semibold">Notes: </span>
            {op.notes}
          </p>
        )}

        <footer className="mt-16 grid grid-cols-2 gap-16 text-sm">
          <div className="border-t pt-2 text-neutral-500">{countSheet ? "Counted by" : pickingList ? "Picked by" : "Prepared by"}</div>
          <div className="border-t pt-2 text-neutral-500">{handSheet ? "Checked by" : op.type === "receipt" ? "Received by" : "Signature"}</div>
        </footer>
      </article>
    </div>
  );
}
