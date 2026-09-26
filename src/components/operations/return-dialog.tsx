"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { api } from "@/lib/api-client";
import { operationPath } from "@/lib/constants";
import { formatQty, round3 } from "@/lib/format";
import type { OperationDTO } from "@/lib/types";

/** What can still come back on each delivered line. */
export function returnableLines(operation: OperationDTO) {
  return operation.lines.map((line) => ({ line, open: Math.max(0, round3(line.quantity - line.returned)) }));
}

function ReturnForm({ operation, onDone }: { operation: OperationDTO; onDone: () => void }) {
  const router = useRouter();
  const rows = returnableLines(operation);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(rows.map(({ line, open }) => [line.id, String(open)])));
  const create = useApiMutation<{ lineId: string; quantity: number }[], { id: string; reference: string }>({
    mutationFn: (lines) => api(`/api/operations/${operation.id}/return`, { method: "POST", body: { lines } }),
    onSuccess: (created) => {
      toast.success(`Return ${created.reference} created`, { description: "Validate it once the goods are back on the shelf." });
      onDone();
      router.push(operationPath("receipt", created.id));
    },
  });

  const parsed = rows.map(({ line, open }) => {
    const quantity = Number(values[line.id]);
    return { line, open, quantity, invalid: values[line.id] === "" || !Number.isFinite(quantity) || quantity < 0 || quantity > open };
  });
  const anyInvalid = parsed.some((row) => row.invalid);
  const nothing = parsed.every((row) => row.invalid || row.quantity === 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    // Rendered inside the operation form: keep this submit from saving the delivery.
    event.stopPropagation();
    if (anyInvalid || nothing) return;
    create.mutate(parsed.filter((row) => row.quantity > 0).map((row) => ({ lineId: row.line.id, quantity: row.quantity })));
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Returned</TableHead>
              <TableHead className="text-right">Return now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed.map(({ line, open, invalid }) => (
              <TableRow key={line.id}>
                <TableCell className="max-w-48">
                  <p className="truncate font-medium">{line.productName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatQty(line.quantity)} <span className="text-xs text-muted-foreground">{line.uom}</span>
                </TableCell>
                <TableCell className="text-right tabular text-muted-foreground">{formatQty(line.returned)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={open}
                    step="any"
                    value={values[line.id]}
                    disabled={open === 0}
                    onChange={(event) => setValues((current) => ({ ...current, [line.id]: event.target.value }))}
                    aria-label={`Quantity of ${line.productName} coming back`}
                    aria-invalid={invalid}
                    className="ml-auto h-8 w-24 text-right tabular"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {anyInvalid && <p className="text-sm text-destructive">Each quantity must be between 0 and what is left to return.</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Back
        </Button>
        <Button type="submit" disabled={create.isPending || anyInvalid || nothing}>
          {create.isPending ? <Spinner /> : <Undo2 />}
          Create return
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Customer return of a validated delivery: creates a draft receipt that brings the goods back. */
export function ReturnDialog({ operation, open, onOpenChange }: { operation: OperationDTO; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Return products · <span className="font-mono">{operation.reference}</span>
          </DialogTitle>
          <DialogDescription>
            Creates a receipt from {operation.contact || "the customer"} back into {operation.sourceLocation.fullName}. Stock goes up when you validate it.
          </DialogDescription>
        </DialogHeader>
        {open && <ReturnForm operation={operation} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
