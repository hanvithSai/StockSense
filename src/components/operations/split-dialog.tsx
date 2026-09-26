"use client";

import { Split } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQty, round3 } from "@/lib/format";
import type { AvailabilityDTO, OperationDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SplitRequest {
  lines?: { lineId: string; quantity: number }[];
  validate?: boolean;
}

const COPY = {
  receipt: {
    title: "Receive partially",
    description: "Enter what arrived. It is added to stock now; the rest stays expected in a backorder.",
    now: "Received now",
  },
  delivery: {
    title: "Ship what is in stock",
    description: "Ship the available quantities now. The rest waits in a backorder that becomes ready by itself when stock arrives.",
    now: "Ship now",
  },
  internal: {
    title: "Move what is in stock",
    description: "Move the available quantities now. The rest waits in a backorder that becomes ready by itself when stock arrives.",
    now: "Move now",
  },
} as const;

function SplitForm({
  operation,
  availability,
  onConfirm,
  onCancel,
}: {
  operation: OperationDTO;
  availability?: AvailabilityDTO;
  onConfirm: (request: SplitRequest) => Promise<boolean>;
  onCancel: () => void;
}) {
  const receiving = operation.type === "receipt";
  const copy = COPY[operation.type === "adjustment" ? "internal" : operation.type];
  const [received, setReceived] = useState<Record<string, string>>(() =>
    Object.fromEntries(operation.lines.map((line) => [line.id, String(line.quantity)])),
  );
  const [pending, setPending] = useState(false);

  const rows = operation.lines.map((line) => {
    const inStock = Math.max(0, availability?.[line.productId]?.free ?? 0);
    const typed = Number(received[line.id]);
    const now = receiving ? typed : Math.min(line.quantity, inStock);
    const invalid = receiving && (received[line.id] === "" || !Number.isFinite(typed) || typed < 0 || typed > line.quantity);
    return { line, inStock, now, rest: invalid ? 0 : round3(line.quantity - now), invalid };
  });
  const anyInvalid = rows.some((row) => row.invalid);
  const nothingNow = rows.every((row) => !row.invalid && row.now === 0);
  const nothingLater = rows.every((row) => row.rest === 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // The dialog is rendered inside the operation form: keep this submit from saving the document.
    event.stopPropagation();
    if (anyInvalid || nothingNow) return;
    setPending(true);
    const request: SplitRequest = receiving
      ? { validate: true, lines: rows.map((row) => ({ lineId: row.line.id, quantity: row.now })) }
      : {};
    const done = await onConfirm(request);
    setPending(false);
    if (done) onCancel();
  }

  const confirmLabel = receiving
    ? nothingLater
      ? "Validate"
      : "Validate and create backorder"
    : operation.type === "delivery"
      ? "Ship available, create backorder"
      : "Move available, create backorder";

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              {!receiving && <TableHead className="text-right">In stock</TableHead>}
              <TableHead className="text-right">{copy.now}</TableHead>
              <TableHead className="text-right">Backorder</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ line, inStock, now, rest, invalid }) => (
              <TableRow key={line.id}>
                <TableCell className="max-w-48">
                  <p className="truncate font-medium">{line.productName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatQty(line.quantity)} <span className="text-xs text-muted-foreground">{line.uom}</span>
                </TableCell>
                {!receiving && <TableCell className="text-right tabular text-muted-foreground">{formatQty(inStock)}</TableCell>}
                <TableCell className="text-right">
                  {receiving ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={line.quantity}
                      step="any"
                      value={received[line.id]}
                      onChange={(event) => setReceived((current) => ({ ...current, [line.id]: event.target.value }))}
                      aria-label={`Received quantity of ${line.productName}`}
                      aria-invalid={invalid}
                      className="ml-auto h-8 w-24 text-right tabular"
                    />
                  ) : (
                    <span className={cn("font-medium tabular", now === 0 && "text-muted-foreground")}>{formatQty(now)}</span>
                  )}
                </TableCell>
                <TableCell className={cn("text-right tabular", rest > 0 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                  {formatQty(rest)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {anyInvalid && <p className="text-sm text-destructive">Received quantities must be between 0 and the ordered quantity.</p>}
      {!receiving && nothingNow && <p className="text-sm text-muted-foreground">Nothing is in stock yet at {operation.sourceLocation.fullName}.</p>}
      {!receiving && !nothingNow && nothingLater && (
        <p className="text-sm text-muted-foreground">Everything is in stock: use Check availability instead.</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" disabled={pending || anyInvalid || nothingNow || (!receiving && nothingLater)}>
          {pending ? <Spinner /> : <Split />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Partial processing with a backorder for the rest (Odoo-style), for receipts, deliveries and transfers. */
export function SplitDialog({
  operation,
  availability,
  open,
  onOpenChange,
  onConfirm,
}: {
  operation: OperationDTO;
  availability?: AvailabilityDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (request: SplitRequest) => Promise<boolean>;
}) {
  const copy = COPY[operation.type === "adjustment" ? "internal" : operation.type];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {copy.title} · <span className="font-mono">{operation.reference}</span>
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {open && <SplitForm operation={operation} availability={availability} onConfirm={onConfirm} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
