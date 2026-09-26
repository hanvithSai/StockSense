"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, Pencil, Plus, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StockBadge } from "@/components/common/stock-badge";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { SelectField } from "@/components/forms/select-field";
import { useSession } from "@/components/layout/session-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useProductOptions, useWarehouses } from "@/hooks/use-reference-data";
import { api, qs } from "@/lib/api-client";
import { formatQty } from "@/lib/format";
import type { ReorderRuleDTO } from "@/lib/types";
import { reorderRuleSchema, type ReorderRuleInput } from "@/lib/validation/master";

function RuleForm({ rule, onDone }: { rule: ReorderRuleDTO | null; onDone: () => void }) {
  const { data: products = [] } = useProductOptions();
  const { data: warehouses = [] } = useWarehouses();
  const form = useForm<ReorderRuleInput>({
    resolver: zodResolver(reorderRuleSchema),
    defaultValues: {
      product: rule?.product.id ?? "",
      warehouse: rule?.warehouse.id ?? warehouses[0]?.id ?? "",
      minQty: rule?.minQty ?? 0,
      maxQty: rule?.maxQty ?? 0,
    },
  });
  const save = useApiMutation<ReorderRuleInput>({
    mutationFn: (values) =>
      rule
        ? api(`/api/reorder-rules/${rule.id}`, { method: "PATCH", body: values })
        : api("/api/reorder-rules", { method: "POST", body: values }),
    success: rule ? "Rule updated" : "Rule created",
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
          name="product"
          render={({ field }) => (
            <SelectField
              label="Product"
              required
              value={field.value}
              onChange={field.onChange}
              options={products.map((product) => ({ value: product.id, label: product.name, hint: product.sku }))}
              error={errors.product?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="warehouse"
          render={({ field }) => (
            <SelectField
              label="Warehouse"
              required
              value={field.value}
              onChange={field.onChange}
              options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name, hint: warehouse.shortCode }))}
              error={errors.warehouse?.message}
            />
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Minimum quantity"
            required
            type="number"
            min={0}
            step="any"
            description="Alert when on hand ≤ this."
            error={errors.minQty?.message}
            {...form.register("minQty", { valueAsNumber: true })}
          />
          <TextField
            label="Maximum quantity"
            required
            type="number"
            min={0}
            step="any"
            description="Replenish up to this level."
            error={errors.maxQty?.message}
            {...form.register("maxQty", { valueAsNumber: true })}
          />
        </div>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {rule ? "Save changes" : "Create rule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReorderingView() {
  const { can } = useSession();
  const canWrite = can("master:write");
  const canPlan = can("operation:plan");
  const { data, isLoading } = useQuery({ queryKey: ["reorder-rules"], queryFn: () => api<ReorderRuleDTO[]>("/api/reorder-rules") });
  const { data: warehouses = [] } = useWarehouses();
  const [editing, setEditing] = useState<ReorderRuleDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<ReorderRuleDTO | null>(null);
  const remove = useApiMutation<string>({
    mutationFn: (id) => api(`/api/reorder-rules/${id}`, { method: "DELETE" }),
    success: "Rule deleted",
  });
  const [confirmReplenish, setConfirmReplenish] = useState(false);
  const replenish = useApiMutation<void, { references: string[] }>({
    mutationFn: () => api("/api/reorder-rules/replenish", { method: "POST" }),
    success: (result) =>
      result.references.length ? `Draft receipts created: ${result.references.join(", ")}` : "Nothing to replenish",
  });
  const dueCount = data?.filter((rule) => rule.suggestedQty > 0).length ?? 0;
  const applyDemand = useApiMutation<ReorderRuleDTO>({
    mutationFn: (rule) =>
      api(`/api/reorder-rules/${rule.id}`, {
        method: "PATCH",
        body: { product: rule.product.id, warehouse: rule.warehouse.id, minQty: rule.demand!.minQty, maxQty: rule.demand!.maxQty },
      }),
    success: "Rule updated from recent demand",
  });

  function replenishHref(rule: ReorderRuleDTO) {
    const location = warehouses.find((warehouse) => warehouse.id === rule.warehouse.id)?.defaultLocationId;
    return `/operations/receipts/new${qs({ product: rule.product.id, quantity: rule.suggestedQty, location })}`;
  }

  return (
    <>
      <PageHeader
        title="Reordering rules"
        description="Min / max stock per warehouse. Alerts use on hand, orders use the forecast, and demand-based levels cover 1 to 3 weeks of recent deliveries."
        actions={
          <>
            {canPlan && dueCount > 0 && (
              <Button variant="outline" onClick={() => setConfirmReplenish(true)} disabled={replenish.isPending}>
                {replenish.isPending ? <Spinner /> : <ArrowDownToLine />} Replenish all ({dueCount})
              </Button>
            )}
            {canWrite && (
              <Button onClick={() => setEditing("new")}>
                <Plus /> New rule
              </Button>
            )}
          </>
        }
      />
      <ConfirmDialog
        open={confirmReplenish}
        onOpenChange={setConfirmReplenish}
        title={`Create receipts for ${dueCount} product${dueCount === 1 ? "" : "s"}?`}
        description="One draft receipt per warehouse is created, ordering each product up to its maximum. Assign the vendor on each receipt before confirming it."
        confirmLabel="Create draft receipts"
        onConfirm={() => replenish.mutate()}
      />
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Max</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="hidden text-right md:table-cell">Forecast</TableHead>
              <TableHead className="hidden text-right sm:table-cell">To order</TableHead>
              <TableHead className="hidden text-right lg:table-cell">From demand</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={10} />
            ) : !data?.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10}>
                  <EmptyState icon={RefreshCcw} title="No reordering rules" description="Add a rule to get low stock alerts." />
                </TableCell>
              </TableRow>
            ) : (
              data.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Link href={`/products/${rule.product.id}`} className="font-medium hover:underline">
                      {rule.product.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{rule.product.sku}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{rule.warehouse.name}</TableCell>
                  <TableCell className="text-right tabular">{formatQty(rule.minQty)}</TableCell>
                  <TableCell className="text-right tabular">{formatQty(rule.maxQty)}</TableCell>
                  <TableCell className="text-right tabular font-medium">
                    {formatQty(rule.onHand)} <span className="text-xs font-normal text-muted-foreground">{rule.product.uom}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular md:table-cell">{formatQty(rule.forecast)}</TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">
                    {rule.suggestedQty > 0 ? formatQty(rule.suggestedQty) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    {rule.demand ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm tabular" title={`${formatQty(rule.demand.perDay)} ${rule.product.uom} shipped per day`}>
                          {formatQty(rule.demand.minQty)} – {formatQty(rule.demand.maxQty)}
                        </span>
                        {canWrite && (rule.demand.minQty !== rule.minQty || rule.demand.maxQty !== rule.maxQty) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => applyDemand.mutate(rule)}
                                disabled={applyDemand.isPending}
                                aria-label={`Use demand-based levels for ${rule.product.name}`}
                              >
                                <Sparkles />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Set min {formatQty(rule.demand.minQty)} and max {formatQty(rule.demand.maxQty)} ({formatQty(rule.demand.perDay)} {rule.product.uom}/day)
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground" title="No deliveries in the last 30 days">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <StockBadge status={rule.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canPlan && rule.suggestedQty > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" asChild>
                              <Link href={replenishHref(rule)} aria-label={`Replenish ${rule.product.name}`}>
                                <ArrowDownToLine />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Create receipt for {formatQty(rule.suggestedQty)}</TooltipContent>
                        </Tooltip>
                      )}
                      {canWrite && (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(rule)} aria-label="Edit rule">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(rule)} aria-label="Delete rule">
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New reordering rule" : "Edit reordering rule"}</DialogTitle>
            <DialogDescription>One rule per product and warehouse.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <RuleForm key={editing === "new" ? "new" : editing.id} rule={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this rule?"
        description={`${deleting?.product.name} in ${deleting?.warehouse.name} will no longer raise low stock alerts.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
