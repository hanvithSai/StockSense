"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useLocations } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import { formatQty, round3 } from "@/lib/format";
import type { AvailabilityDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { stockUpdateSchema, type StockUpdateInput } from "@/lib/validation/master";

export interface StockTarget {
  productId: string;
  productName: string;
  uom: string;
  locationId?: string;
}

function UpdateStockForm({ target, onDone }: { target: StockTarget; onDone: () => void }) {
  const { data: locations = [] } = useLocations();
  const form = useForm<StockUpdateInput>({
    resolver: zodResolver(stockUpdateSchema),
    defaultValues: {
      product: target.productId,
      location: target.locationId ?? locations.find((location) => location.isDefault)?.id ?? "",
      countedQty: undefined,
      note: "",
    },
  });
  const location = useWatch({ control: form.control, name: "location" });
  const counted = useWatch({ control: form.control, name: "countedQty" });

  const { data: availability } = useQuery({
    queryKey: ["availability", location, target.productId],
    queryFn: () => api<AvailabilityDTO>(`/api/stock/availability${qs({ location, products: target.productId })}`),
    enabled: Boolean(location),
  });
  const current = availability?.[target.productId];
  const difference = current && typeof counted === "number" && !Number.isNaN(counted) ? round3(counted - current.quantity) : null;

  const save = useApiMutation<StockUpdateInput, { reference: string; promoted: string[] }>({
    mutationFn: (values) => api("/api/stock/adjust", { method: "POST", body: values }),
    success: (result) =>
      `Stock updated (${result.reference})${result.promoted.length ? `. Now ready: ${result.promoted.join(", ")}` : ""}`,
    onSuccess: onDone,
    toastErrors: false,
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        save.mutateAsync(values).catch((error) => applyServerErrors(error, form.setError)),
      )}
    >
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <SelectField
              label="Location"
              required
              value={field.value}
              onChange={field.onChange}
              options={locations.map((item) => ({ value: item.id, label: item.fullName }))}
              error={errors.location?.message}
            />
          )}
        />
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Recorded on hand</p>
            <p className="text-lg font-semibold tabular">
              {formatQty(current?.quantity ?? 0)} <span className="text-sm font-normal text-muted-foreground">{target.uom}</span>
            </p>
          </div>
          <ArrowRight className="mb-4 size-4 text-muted-foreground" />
          <TextField
            label="Counted quantity"
            required
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            autoFocus
            error={errors.countedQty?.message}
            {...form.register("countedQty", { valueAsNumber: true })}
          />
        </div>
        {difference !== null && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              difference > 0 && "bg-success/10 text-emerald-700 dark:text-emerald-300",
              difference < 0 && "bg-destructive/10 text-destructive",
              difference === 0 && "bg-muted text-muted-foreground",
            )}
          >
            {difference === 0
              ? "No difference: the count matches the records."
              : `Difference of ${difference > 0 ? "+" : ""}${formatQty(difference)} ${target.uom} will be logged as an adjustment.`}
          </p>
        )}
        <TextField label="Reason" placeholder="e.g. damaged, cycle count" error={errors.note?.message} {...form.register("note")} />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Apply count
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UpdateStockDialog({ target, onClose }: { target: StockTarget | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update stock · {target?.productName}</DialogTitle>
          <DialogDescription>Enter the physically counted quantity. The change is logged in the stock ledger.</DialogDescription>
        </DialogHeader>
        {target && <UpdateStockForm key={`${target.productId}-${target.locationId ?? ""}`} target={target} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
