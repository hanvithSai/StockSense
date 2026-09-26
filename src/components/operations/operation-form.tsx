"use client";

import { toNestErrors } from "@hookform/resolvers";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  CircleCheck,
  Copy,
  Hand,
  ListChecks,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  ScanBarcode,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { applyServerErrors, TextareaField, TextField } from "@/components/forms/fields";
import { SelectField } from "@/components/forms/select-field";
import { useSession } from "@/components/layout/session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { primaryLocationId, useLocations, useProductOptions, useUserOptions, useWarehouses } from "@/hooks/use-reference-data";
import { api, ApiError, errorMessage, qs } from "@/lib/api-client";
import { OPERATION_META, operationPath, type OperationType } from "@/lib/constants";
import { formatDateTime, formatQty, round3, todayISO } from "@/lib/format";
import { manageCapability } from "@/lib/permissions";
import type { AvailabilityDTO, OperationActionResult, OperationDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  operationFieldsSchema,
  operationRules,
  type OperationAction,
  type OperationFields,
} from "@/lib/validation/operations";
import { StatusSteps } from "./status-steps";
import { ProductPicker } from "./product-picker";

export interface OperationPrefill {
  product?: string;
  quantity?: number;
  location?: string;
}

interface OperationFormProps {
  type: OperationType;
  operation?: OperationDTO;
  prefill?: OperationPrefill;
  /** Existing operation to copy into a new draft (Duplicate). */
  template?: OperationDTO;
}

const CONTACT_LABEL: Partial<Record<OperationType, string>> = { receipt: "Receive from", delivery: "Customer" };

function fromOperation(operation: OperationDTO): OperationFields {
  return {
    sourceLocation: operation.sourceLocation.type === "internal" ? operation.sourceLocation.id : "",
    destLocation: operation.destLocation.type === "internal" ? operation.destLocation.id : "",
    contact: operation.contact,
    deliveryAddress: operation.deliveryAddress,
    scheduledDate: operation.scheduledDate,
    responsible: operation.responsible?.id ?? "",
    notes: operation.notes,
    lines: operation.lines.map((line) => ({ product: line.productId, quantity: line.quantity })),
  };
}

function initialValues(
  type: OperationType,
  operation: OperationDTO | undefined,
  template: OperationDTO | undefined,
  prefill: OperationPrefill | undefined,
  defaultLocation: string,
  userId: string,
): OperationFields {
  if (operation) return fromOperation(operation);
  if (template) return { ...fromOperation(template), scheduledDate: todayISO(), responsible: userId, notes: "" };
  const main = prefill?.location ?? defaultLocation;
  return {
    sourceLocation: type === "delivery" || type === "internal" ? main : "",
    destLocation: type === "receipt" || type === "adjustment" ? main : "",
    contact: "",
    deliveryAddress: "",
    scheduledDate: todayISO(),
    responsible: userId,
    notes: "",
    lines: [
      prefill?.product
        ? { product: prefill.product, quantity: prefill.quantity ?? 1 }
        : { product: "", quantity: type === "adjustment" ? 0 : 1 },
    ],
  };
}

/** zod shape validation plus the shared type-specific business rules. */
function operationResolver(type: OperationType): Resolver<OperationFields> {
  const base = zodResolver(operationFieldsSchema) as unknown as Resolver<OperationFields>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    const rules = operationRules(type, values);
    if (!Object.keys(rules).length) return result;
    const flat = Object.fromEntries(Object.entries(rules).map(([path, message]) => [path, { type: "custom", message }]));
    // Show shape errors and business-rule errors together; shape errors win on the same field.
    return { values: {}, errors: { ...toNestErrors(flat, options), ...result.errors } };
  };
}

function ActionButton({
  onClick,
  pending,
  icon: Icon,
  children,
  variant = "default",
  disabled,
}: {
  onClick: () => void;
  pending: boolean;
  icon: React.ComponentType;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Button type="button" variant={variant} onClick={onClick} disabled={pending || disabled}>
      {pending ? <Spinner /> : <Icon />}
      {children}
    </Button>
  );
}

export function OperationForm({ type, operation, prefill, template }: OperationFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, can } = useSession();
  const meta = OPERATION_META[type];
  const status = operation?.status ?? "new";
  const isNew = !operation;
  const isOpen = isNew || status === "draft" || status === "waiting" || status === "ready";
  const canManage = can(manageCapability(type));
  const canProcess = can("operation:process");
  const headerEditable = canManage && isOpen;
  const structureEditable = canManage && (isNew || status === "draft" || (type === "receipt" && status === "ready"));

  const { data: locations = [] } = useLocations();
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProductOptions();
  const { data: users = [] } = useUserOptions();
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", type],
    queryFn: () => api<string[]>(`/api/operations/contacts${qs({ type })}`),
    enabled: type === "receipt" || type === "delivery",
  });

  const resolver = useMemo(() => operationResolver(type), [type]);
  const form = useForm<OperationFields>({
    resolver,
    defaultValues: initialValues(type, operation, template, prefill, primaryLocationId(warehouses, locations), user.id),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = useWatch({ control: form.control, name: "lines" }) ?? [];
  const sourceLocation = useWatch({ control: form.control, name: "sourceLocation" });
  const destLocation = useWatch({ control: form.control, name: "destLocation" });
  const { errors, isDirty } = form.formState;

  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [scan, setScan] = useState("");

  // Ctrl/Cmd + S saves the document.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (headerEditable && (isNew || form.formState.isDirty)) void form.handleSubmit(onSubmit)();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /** Barcode scanners type the SKU followed by Enter: add the product or increase its quantity. */
  function addScanned() {
    const code = scan.trim();
    if (!code) return;
    const product =
      products.find((item) => item.sku === code.toUpperCase()) ??
      products.find((item) => item.name.toLowerCase() === code.toLowerCase());
    if (!product) {
      toast.error(`No active product with SKU "${code}"`);
      return;
    }
    const current = form.getValues("lines");
    const existing = current.findIndex((line) => line.product === product.id);
    if (existing >= 0) {
      form.setValue(`lines.${existing}.quantity`, round3((Number(current[existing].quantity) || 0) + 1), { shouldDirty: true });
    } else {
      const empty = current.findIndex((line) => !line.product);
      if (empty >= 0) {
        form.setValue(`lines.${empty}.product`, product.id, { shouldDirty: true });
        form.setValue(`lines.${empty}.quantity`, 1, { shouldDirty: true });
      } else {
        append({ product: product.id, quantity: 1 });
      }
    }
    toast.success(`${product.name} +1`, { duration: 1200 });
    setScan("");
  }

  // Live availability at the location stock is taken from (or counted at, for adjustments).
  const stockLocation = type === "adjustment" ? destLocation : sourceLocation;
  const productIds = lines.map((line) => line.product).filter(Boolean);
  const showAvailability = type !== "receipt" && isOpen;
  const { data: availability } = useQuery({
    queryKey: ["availability", stockLocation, productIds.join(",")],
    queryFn: () => api<AvailabilityDTO>(`/api/stock/availability${qs({ location: stockLocation, products: productIds })}`),
    enabled: showAvailability && Boolean(stockLocation) && productIds.length > 0,
  });

  const internalOptions = locations.map((location) => ({
    value: location.id,
    label: location.fullName,
    hint: location.name,
  }));
  const sourceWarehouse = locations.find((location) => location.id === sourceLocation)?.warehouse?.id ?? "";

  /* ------------------------------------------------------------- saving */

  async function refreshAfter(updated?: OperationDTO) {
    if (updated) queryClient.setQueryData(["operation", updated.id], updated);
    await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "operation" });
  }

  async function saveEdits(values: OperationFields, silent = false): Promise<boolean> {
    if (!operation) return false;
    try {
      const updated = await api<OperationDTO>(`/api/operations/${operation.id}${qs({ today: todayISO() })}`, {
        method: "PATCH",
        body: { ...values, version: operation.updatedAt },
      });
      await refreshAfter(updated);
      if (!silent) toast.success("Changes saved");
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === "STALE") {
        toast.error(error.message, {
          action: {
            label: "Reload",
            onClick: () => void queryClient.invalidateQueries({ queryKey: ["operation", operation.id] }),
          },
        });
      } else {
        applyServerErrors(error, form.setError);
      }
      return false;
    }
  }

  async function onSubmit(values: OperationFields) {
    if (operation) {
      setPending("save");
      await saveEdits(values);
      setPending(null);
      return;
    }
    setPending("save");
    try {
      const { id } = await api<{ id: string }>("/api/operations", { method: "POST", body: { ...values, type } });
      await refreshAfter();
      toast.success(`${meta.label} created`);
      router.push(operationPath(type, id));
    } catch (error) {
      applyServerErrors(error, form.setError);
      setPending(null);
    }
  }

  function announce(action: OperationAction, result: OperationActionResult) {
    const { operation: updated, shortages, promoted } = result;
    if ((action === "confirm" || action === "check-availability") && updated.status === "waiting") {
      toast.warning("Waiting for stock", {
        description: shortages.map((item) => `${item.productName}: need ${formatQty(item.required)}, ${formatQty(item.available)} free`).join(" · "),
      });
      return;
    }
    const messages: Record<OperationAction, string> = {
      confirm: type === "receipt" ? "Ready to receive" : "Stock reserved, ready to process",
      "check-availability": "Stock is now available, operation is ready",
      pick: "Items picked",
      pack: "Items packed",
      validate: `${updated.reference} validated, stock updated`,
      cancel: `${updated.reference} cancelled`,
      reset: "Reset to draft",
    };
    toast.success(messages[action], promoted.length ? { description: `Now ready: ${promoted.join(", ")}` } : undefined);
  }

  async function runAction(action: OperationAction, body: unknown = {}) {
    if (!operation) return;
    setPending(action);
    try {
      if (isDirty && headerEditable) {
        let saved = false;
        await form.handleSubmit(
          async (values) => {
            saved = await saveEdits(values, true);
          },
          () => toast.error("Please fix the highlighted fields first"),
        )();
        if (!saved) return;
      }
      const result = await api<OperationActionResult>(`/api/operations/${operation.id}/${action}${qs({ today: todayISO() })}`, {
        method: "POST",
        body,
      });
      await refreshAfter(result.operation);
      announce(action, result);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(null);
    }
  }

  async function deleteOperation() {
    if (!operation) return;
    try {
      await api(`/api/operations/${operation.id}`, { method: "DELETE" });
      await refreshAfter();
      toast.success(`${operation.reference} deleted`);
      router.push(operationPath(type));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /* ------------------------------------------------------------ actions */

  const allPicked = Boolean(operation?.lines.length) && Boolean(operation?.lines.every((line) => line.picked));
  const primary = (() => {
    if (!operation || !canProcess) return null;
    switch (operation.status) {
      case "draft":
        return type === "adjustment"
          ? { action: "validate" as const, label: "Validate", icon: CheckCheck }
          : { action: "confirm" as const, label: "To Do", icon: ListChecks };
      case "waiting":
        return { action: "check-availability" as const, label: "Check availability", icon: RefreshCw };
      case "ready":
        if (type === "delivery" && !allPicked) return { action: "pick" as const, label: "Pick items", icon: Hand, body: { picked: true } };
        if (type === "delivery" && !operation.packed) return { action: "pack" as const, label: "Pack", icon: PackageCheck, body: { packed: true } };
        return { action: "validate" as const, label: "Validate", icon: CheckCheck };
      default:
        return null;
    }
  })();

  const canCancel = Boolean(operation) && canManage && isOpen && !isNew;
  const canReset = Boolean(operation) && canManage && (status === "waiting" || status === "ready" || status === "cancelled");
  const canDelete = Boolean(operation) && canManage && (status === "draft" || status === "cancelled");
  const pickable = type === "delivery" && status === "ready" && canProcess;
  // Done documents print as slips; draft counts as blind count sheets; ready moves as picking lists.
  const printLabel =
    status === "done"
      ? "Print"
      : type === "adjustment" && status === "draft"
        ? "Count sheet"
        : (type === "delivery" || type === "internal") && status === "ready"
          ? "Picking list"
          : null;

  /* ---------------------------------------------------------------- UI */

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Link href={operationPath(type)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {meta.plural}
      </Link>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {isNew ? (
            <>
              <ActionButton onClick={form.handleSubmit(onSubmit)} pending={pending === "save"} icon={Save}>
                Save
              </ActionButton>
              <Button type="button" variant="outline" asChild>
                <Link href={operationPath(type)}>
                  <X /> Discard
                </Link>
              </Button>
            </>
          ) : (
            <>
              {primary && (
                <ActionButton onClick={() => runAction(primary.action, "body" in primary ? primary.body : {})} pending={pending === primary.action} icon={primary.icon}>
                  {primary.label}
                </ActionButton>
              )}
              {isDirty && headerEditable && (
                <ActionButton variant="outline" onClick={form.handleSubmit(onSubmit)} pending={pending === "save"} icon={Save}>
                  Save
                </ActionButton>
              )}
              {printLabel && (
                <Button type="button" variant="outline" asChild>
                  <Link href={`/print/operations/${operation!.id}`} target="_blank">
                    <Printer /> {printLabel}
                  </Link>
                </Button>
              )}
              {canCancel && (
                <Button type="button" variant="outline" onClick={() => setConfirm("cancel")} disabled={Boolean(pending)}>
                  <Ban /> Cancel
                </Button>
              )}
              {(canReset || canDelete || canManage) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="More actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {canManage && (
                      <DropdownMenuItem onSelect={() => router.push(`${operationPath(type)}/new?from=${operation!.id}`)}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                    )}
                    {canReset && (
                      <DropdownMenuItem onSelect={() => runAction("reset")}>
                        <RotateCcw /> Reset to draft
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
        <StatusSteps type={type} status={status} />
      </div>

      {type === "delivery" && operation && (status === "ready" || status === "done") && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { label: "Pick", done: allPicked || status === "done" },
            { label: "Pack", done: operation.packed || status === "done" },
            { label: "Validate", done: status === "done" },
          ].map((step, index) => (
            <span
              key={step.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-inset",
                step.done ? "bg-success/10 text-emerald-700 ring-success/30 dark:text-emerald-300" : "text-muted-foreground ring-border",
              )}
            >
              {step.done ? <CircleCheck className="size-3.5" /> : <span className="text-xs tabular">{index + 1}</span>}
              {step.label}
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono text-2xl tracking-tight">{operation?.reference ?? `New ${meta.label}`}</CardTitle>
            {operation?.isLate && (
              <Badge variant="destructive">
                <TriangleAlert /> Late
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {operation ? `${operation.warehouse.name} · ${operation.sourceLocation.fullName} → ${operation.destLocation.fullName}` : meta.plural}
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {(type === "receipt" || type === "delivery") && (
              <div>
                <TextField
                  label={CONTACT_LABEL[type]!}
                  required
                  list={`contacts-${type}`}
                  placeholder={type === "receipt" ? "Vendor name" : "Customer name"}
                  disabled={!headerEditable}
                  error={errors.contact?.message}
                  {...form.register("contact")}
                />
                <datalist id={`contacts-${type}`}>
                  {contacts.map((contact) => (
                    <option key={contact} value={contact} />
                  ))}
                </datalist>
              </div>
            )}

            {type === "delivery" && (
              <SelectField
                label="Operation type"
                value={sourceWarehouse}
                onChange={(warehouseId) => {
                  const warehouse = warehouses.find((item) => item.id === warehouseId);
                  if (warehouse?.defaultLocationId) form.setValue("sourceLocation", warehouse.defaultLocationId, { shouldDirty: true });
                }}
                options={warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name}: Delivery Orders` }))}
                disabled={!structureEditable}
              />
            )}

            {(type === "delivery" || type === "internal") && (
              <Controller
                control={form.control}
                name="sourceLocation"
                render={({ field }) => (
                  <SelectField
                    label={type === "internal" ? "Source location" : "Ship from"}
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={type === "delivery" && sourceWarehouse ? internalOptions.filter((option) => locations.find((l) => l.id === option.value)?.warehouse?.id === sourceWarehouse) : internalOptions}
                    disabled={!structureEditable}
                    error={errors.sourceLocation?.message}
                  />
                )}
              />
            )}

            {(type === "receipt" || type === "internal" || type === "adjustment") && (
              <Controller
                control={form.control}
                name="destLocation"
                render={({ field }) => (
                  <SelectField
                    label={type === "adjustment" ? "Counted location" : "Destination location"}
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={type === "internal" ? internalOptions.filter((option) => option.value !== sourceLocation) : internalOptions}
                    disabled={!structureEditable}
                    error={errors.destLocation?.message}
                  />
                )}
              />
            )}

            {type === "delivery" && (
              <TextField
                label="Delivery address"
                placeholder="Street, city"
                disabled={!headerEditable}
                error={errors.deliveryAddress?.message}
                {...form.register("deliveryAddress")}
              />
            )}

            <TextField
              label={type === "adjustment" ? "Count date" : "Schedule date"}
              type="date"
              required
              disabled={!headerEditable}
              error={errors.scheduledDate?.message}
              {...form.register("scheduledDate")}
            />

            <Controller
              control={form.control}
              name="responsible"
              render={({ field }) => (
                <SelectField
                  label="Responsible"
                  value={field.value}
                  onChange={field.onChange}
                  options={users.map((item) => ({ value: item.id, label: item.name }))}
                  placeholder={operation?.responsible?.name ?? "Select a user"}
                  disabled={!headerEditable}
                  error={errors.responsible?.message}
                />
              )}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Products</h3>
              <div className="flex flex-wrap items-center gap-3">
                {showAvailability && stockLocation && (
                  <span className="text-xs text-muted-foreground">
                    Live stock at {locations.find((location) => location.id === stockLocation)?.fullName}
                  </span>
                )}
                {structureEditable && (
                  <InputGroup className="h-9 w-full sm:w-72">
                    <InputGroupAddon>
                      <ScanBarcode />
                    </InputGroupAddon>
                    <InputGroupInput
                      value={scan}
                      onChange={(event) => setScan(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addScanned();
                        }
                      }}
                      placeholder="Scan or type a SKU, press Enter"
                      aria-label="Scan or type a SKU"
                    />
                  </InputGroup>
                )}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Product</TableHead>
                    {showAvailability && (
                      <TableHead className="text-right">{type === "adjustment" ? "Recorded" : "Free to use"}</TableHead>
                    )}
                    {type === "adjustment" && status === "done" && <TableHead className="text-right">Recorded</TableHead>}
                    <TableHead className="w-36 text-right">{type === "adjustment" ? "Counted" : "Quantity"}</TableHead>
                    {type === "adjustment" && <TableHead className="text-right">Difference</TableHead>}
                    {pickable && <TableHead className="w-20 text-center">Picked</TableHead>}
                    {structureEditable && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const line = lines[index];
                    const opLine = operation?.lines[index];
                    const product = products.find((item) => item.id === line?.product);
                    const uom = product?.uom ?? opLine?.uom ?? "";
                    const stock = line?.product ? availability?.[line.product] : undefined;
                    const quantity = Number(line?.quantity) || 0;
                    const short =
                      (type === "delivery" || type === "internal") &&
                      (isNew || status === "draft" || status === "waiting") &&
                      stock !== undefined &&
                      quantity > stock.free;
                    const difference =
                      type === "adjustment"
                        ? status === "done"
                          ? (opLine?.delta ?? 0)
                          : stock
                            ? round3(quantity - stock.quantity)
                            : null
                        : null;
                    const lineErrors = errors.lines?.[index];

                    return (
                      <TableRow key={field.id} className={cn(short && "bg-destructive/5 hover:bg-destructive/10")}>
                        <TableCell className="min-w-56 align-top">
                          <Controller
                            control={form.control}
                            name={`lines.${index}.product`}
                            render={({ field: productField }) => (
                              <ProductPicker
                                value={productField.value}
                                onChange={productField.onChange}
                                products={products}
                                exclude={lines.map((item) => item.product)}
                                disabled={!structureEditable}
                                invalid={Boolean(lineErrors?.product)}
                                fallbackLabel={opLine ? `[${opLine.sku}] ${opLine.productName}` : undefined}
                              />
                            )}
                          />
                          {lineErrors?.product && <FieldError className="mt-1">{lineErrors.product.message}</FieldError>}
                          {short && (
                            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                              <TriangleAlert className="size-3.5" /> Not enough stock: {formatQty(stock?.free)} {uom} free
                            </p>
                          )}
                        </TableCell>
                        {showAvailability && (
                          <TableCell className={cn("text-right align-top tabular", short && "font-semibold text-destructive")}>
                            <span className="inline-block pt-2">
                              {stock ? formatQty(type === "adjustment" ? stock.quantity : stock.free) : "—"}
                            </span>
                          </TableCell>
                        )}
                        {type === "adjustment" && status === "done" && (
                          <TableCell className="text-right align-top tabular">
                            <span className="inline-block pt-2">{formatQty(opLine?.systemQty)}</span>
                          </TableCell>
                        )}
                        <TableCell className="align-top">
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              aria-label="Quantity"
                              aria-invalid={Boolean(lineErrors?.quantity) || short}
                              disabled={!structureEditable}
                              className="h-9 w-24 text-right tabular"
                              {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                            />
                            <span className="w-10 text-left text-xs text-muted-foreground">{uom}</span>
                          </div>
                          {lineErrors?.quantity && <FieldError className="mt-1 text-right">{lineErrors.quantity.message}</FieldError>}
                        </TableCell>
                        {type === "adjustment" && (
                          <TableCell
                            className={cn(
                              "text-right align-top tabular font-medium",
                              difference !== null && difference > 0 && "text-emerald-600 dark:text-emerald-400",
                              difference !== null && difference < 0 && "text-destructive",
                            )}
                          >
                            <span className="inline-block pt-2">
                              {difference === null ? "—" : `${difference > 0 ? "+" : ""}${formatQty(difference)}`}
                            </span>
                          </TableCell>
                        )}
                        {pickable && (
                          <TableCell className="text-center align-top">
                            <Checkbox
                              className="mt-2.5"
                              checked={Boolean(opLine?.picked)}
                              disabled={Boolean(pending) || !opLine}
                              onCheckedChange={(checked) => opLine && runAction("pick", { lineIds: [opLine.id], picked: checked === true })}
                              aria-label={`Picked ${opLine?.productName ?? ""}`}
                            />
                          </TableCell>
                        )}
                        {structureEditable && (
                          <TableCell className="align-top">
                            <Button type="button" variant="ghost" size="icon-sm" className="mt-0.5" onClick={() => remove(index)} aria-label="Remove line">
                              <Trash2 />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {fields.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No products yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {(errors.lines?.root?.message ?? errors.lines?.message) && (
              <FieldError>{errors.lines?.root?.message ?? errors.lines?.message}</FieldError>
            )}
            {structureEditable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ product: "", quantity: type === "adjustment" ? 0 : 1 })}
              >
                <Plus /> Add a product
              </Button>
            )}
          </div>

          <TextareaField
            label={type === "adjustment" ? "Reason" : "Notes"}
            rows={2}
            placeholder={type === "adjustment" ? "e.g. 3 kg damaged during handling" : "Internal notes"}
            disabled={!headerEditable}
            error={errors.notes?.message}
            {...form.register("notes")}
          />

          {operation?.doneAt && (
            <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CircleCheck className="size-4" />
              Validated by {operation.doneByName ?? "—"} on {formatDateTime(operation.doneAt)}
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Cancel ${operation?.reference}?`}
        description="Reserved stock is released. You can reset a cancelled operation to draft later."
        confirmLabel="Cancel operation"
        destructive
        onConfirm={() => runAction("cancel")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete ${operation?.reference}?`}
        description="This draft will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={deleteOperation}
      />
    </form>
  );
}
