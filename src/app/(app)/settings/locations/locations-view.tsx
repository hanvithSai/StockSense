"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes, ClipboardList, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterSelect } from "@/components/common/filter-select";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { SelectField } from "@/components/forms/select-field";
import { useSession } from "@/components/layout/session-context";
import { CountLocationDialog } from "@/components/stock/count-location-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useLocations, useWarehouses } from "@/hooks/use-reference-data";
import { api } from "@/lib/api-client";
import type { LocationDTO } from "@/lib/types";
import { locationSchema, type LocationInput } from "@/lib/validation/master";

function LocationForm({
  location,
  defaultWarehouse,
  onDone,
}: {
  location: LocationDTO | null;
  defaultWarehouse: string;
  onDone: () => void;
}) {
  const { data: warehouses = [] } = useWarehouses();
  const form = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: location?.name ?? "",
      shortCode: location?.shortCode ?? "",
      warehouse: location?.warehouse?.id ?? defaultWarehouse,
    },
  });
  const save = useApiMutation<LocationInput>({
    mutationFn: (values) =>
      location
        ? api(`/api/locations/${location.id}`, { method: "PATCH", body: values })
        : api("/api/locations", { method: "POST", body: values }),
    invalidate: [["locations"], ["warehouses"]],
    success: location ? "Location updated" : "Location created",
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
        <TextField label="Name" required placeholder="Rack A" error={errors.name?.message} {...form.register("name")} />
        <TextField
          label="Short code"
          required
          placeholder="RackA"
          description="Shown as WAREHOUSE/CODE, e.g. WH/RackA."
          error={errors.shortCode?.message}
          {...form.register("shortCode")}
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
              placeholder="Select a warehouse"
              error={errors.warehouse?.message}
            />
          )}
        />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {location ? "Save changes" : "Create location"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function LocationsView() {
  const { can } = useSession();
  const canWrite = can("master:write");
  const canCount = can("stock:move");
  const searchParams = useSearchParams();
  const [warehouseFilter, setWarehouseFilter] = useState(searchParams.get("warehouse") ?? "");
  const { data: warehouses = [] } = useWarehouses();
  const { data, isLoading } = useLocations();
  const [editing, setEditing] = useState<LocationDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<LocationDTO | null>(null);
  const [counting, setCounting] = useState<LocationDTO | null>(null);
  const remove = useApiMutation<string>({
    mutationFn: (id) => api(`/api/locations/${id}`, { method: "DELETE" }),
    invalidate: [["locations"], ["warehouses"]],
    success: "Location deleted",
  });

  const rows = (data ?? []).filter((location) => !warehouseFilter || location.warehouse?.id === warehouseFilter);

  return (
    <>
      <PageHeader
        title="Locations"
        description="Racks, rooms and floors inside each warehouse that hold stock."
        actions={
          canWrite && (
            <Button onClick={() => setEditing("new")} disabled={!warehouses.length}>
              <Plus /> New location
            </Button>
          )
        }
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <FilterSelect
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            allLabel="All warehouses"
            options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
          />
          <span className="ml-auto text-sm text-muted-foreground">{rows.length} locations</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={4} />
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <EmptyState icon={MapPin} title="No locations" description="Add racks or rooms to organise stock." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    {location.fullName}
                    {location.isDefault && (
                      <Badge variant="secondary" className="ml-2 font-sans">
                        Main stock
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{location.name}</TableCell>
                  <TableCell className="text-muted-foreground">{location.warehouse?.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" asChild aria-label={`Stock at ${location.fullName}`} title="View stock">
                        <Link href={`/stock?location=${location.id}`}>
                          <Boxes />
                        </Link>
                      </Button>
                      {canCount && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setCounting(location)}
                          aria-label={`Count ${location.fullName}`}
                          title="Count this location"
                        >
                          <ClipboardList />
                        </Button>
                      )}
                      {canWrite && (
                        <>
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(location)} aria-label={`Edit ${location.fullName}`} title="Edit">
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(location)}
                            disabled={location.isDefault}
                            aria-label={`Delete ${location.fullName}`}
                            title="Delete"
                          >
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
            <DialogTitle>{editing === "new" ? "New location" : "Edit location"}</DialogTitle>
            <DialogDescription>Locations hold the stock of a warehouse (rooms, racks, floors).</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <LocationForm
              key={editing === "new" ? "new" : editing.id}
              location={editing === "new" ? null : editing}
              defaultWarehouse={warehouseFilter || warehouses[0]?.id || ""}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.fullName}?`}
        description="Only empty locations without history can be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />

      <CountLocationDialog
        open={counting !== null}
        onOpenChange={(open) => !open && setCounting(null)}
        defaultLocation={counting?.id}
      />
    </>
  );
}
