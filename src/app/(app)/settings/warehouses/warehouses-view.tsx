"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, MoreHorizontal, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { applyServerErrors, TextareaField, TextField } from "@/components/forms/fields";
import { useSession } from "@/components/layout/session-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useWarehouses } from "@/hooks/use-reference-data";
import { api } from "@/lib/api-client";
import type { WarehouseDTO } from "@/lib/types";
import { warehouseSchema, type WarehouseInput } from "@/lib/validation/master";

function WarehouseForm({ warehouse, onDone }: { warehouse: WarehouseDTO | null; onDone: () => void }) {
  const form = useForm<WarehouseInput>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: warehouse?.name ?? "",
      shortCode: warehouse?.shortCode ?? "",
      address: warehouse?.address ?? "",
    },
  });
  const save = useApiMutation<WarehouseInput>({
    mutationFn: (values) =>
      warehouse
        ? api(`/api/warehouses/${warehouse.id}`, { method: "PATCH", body: values })
        : api("/api/warehouses", { method: "POST", body: values }),
    invalidate: [["warehouses"], ["locations"]],
    success: warehouse ? "Warehouse updated" : "Warehouse created with a Stock location",
    onSuccess: onDone,
    toastErrors: false,
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => save.mutateAsync(values).catch((error) => applyServerErrors(error, form.setError)))}
    >
      <FieldGroup className="gap-4">
        <TextField label="Name" required placeholder="Main Warehouse" error={errors.name?.message} {...form.register("name")} />
        <TextField
          label="Short code"
          required
          placeholder="WH"
          className="uppercase"
          description="Used in references, e.g. WH/IN/0001."
          error={errors.shortCode?.message}
          {...form.register("shortCode")}
        />
        <TextareaField label="Address" rows={3} placeholder="Street, city, PIN" error={errors.address?.message} {...form.register("address")} />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {warehouse ? "Save changes" : "Create warehouse"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WarehousesView() {
  const { can } = useSession();
  const canWrite = can("master:write");
  const { data, isLoading } = useWarehouses();
  const [editing, setEditing] = useState<WarehouseDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<WarehouseDTO | null>(null);
  const remove = useApiMutation<string>({
    mutationFn: (id) => api(`/api/warehouses/${id}`, { method: "DELETE" }),
    invalidate: [["warehouses"], ["locations"]],
    success: "Warehouse deleted",
  });

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Sites where stock is stored. Each warehouse gets a main Stock location."
        actions={
          canWrite && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> New warehouse
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={Warehouse}
            title="No warehouses yet"
            description="Create your first warehouse to start receiving stock."
            action={canWrite && <Button onClick={() => setEditing("new")}>New warehouse</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((warehouse) => (
            <Card key={warehouse.id} className="gap-4">
              <CardHeader className="flex flex-row items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Warehouse className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate">{warehouse.name}</CardTitle>
                  <span className="mt-1 inline-flex rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{warehouse.shortCode}</span>
                </div>
                {canWrite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${warehouse.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(warehouse)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(warehouse)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="min-h-10 text-muted-foreground">{warehouse.address || "No address"}</p>
                <Link
                  href={`/settings/locations?warehouse=${warehouse.id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <MapPin className="size-4" />
                  {warehouse.locationCount} location{warehouse.locationCount === 1 ? "" : "s"}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New warehouse" : "Edit warehouse"}</DialogTitle>
            <DialogDescription>Name, short code and address of the site.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <WarehouseForm
              key={editing === "new" ? "new" : editing.id}
              warehouse={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="The warehouse and its empty locations will be removed. Warehouses with stock or history cannot be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
