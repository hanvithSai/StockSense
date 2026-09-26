"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { applyServerErrors, TextareaField, TextField } from "@/components/forms/fields";
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
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useCategories, useLocations } from "@/hooks/use-reference-data";
import { api } from "@/lib/api-client";
import { UNITS_OF_MEASURE } from "@/lib/constants";
import type { ProductRowDTO } from "@/lib/types";
import { toOptionalNumber } from "@/lib/validation/common";
import { productCreateSchema, type ProductCreateInput } from "@/lib/validation/master";

function ProductForm({ product, onDone }: { product: ProductRowDTO | null; onDone: () => void }) {
  const router = useRouter();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();
  const defaultLocation = locations.find((location) => location.isDefault)?.id ?? "";

  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      category: product?.category?.id ?? "",
      uom: product?.uom ?? "Units",
      costPrice: product?.costPrice ?? 0,
      description: product?.description ?? "",
      initialQuantity: undefined,
      initialLocation: defaultLocation,
    },
  });

  const save = useApiMutation<ProductCreateInput, { id: string } | ProductRowDTO>({
    mutationFn: (values) => {
      if (product) {
        const { name, sku, category, uom, costPrice, description } = values;
        return api(`/api/products/${product.id}`, {
          method: "PATCH",
          body: { name, sku, category, uom, costPrice, description },
        });
      }
      return api("/api/products", { method: "POST", body: values });
    },
    success: product ? "Product updated" : "Product created",
    toastErrors: false,
    onSuccess: (result) => {
      onDone();
      if (!product) router.push(`/products/${result.id}`);
    },
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
        <TextField label="Product name" required placeholder="Steel Rods" error={errors.name?.message} {...form.register("name")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="SKU / Code"
            required
            placeholder="ROD001"
            className="uppercase"
            error={errors.sku?.message}
            {...form.register("sku")}
          />
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <SelectField
                label="Category"
                required
                value={field.value}
                onChange={field.onChange}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                placeholder={categories.length ? "Select a category" : "Create a category first"}
                error={errors.category?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="uom"
            render={({ field }) => (
              <SelectField
                label="Unit of measure"
                required
                value={field.value}
                onChange={field.onChange}
                options={UNITS_OF_MEASURE.map((unit) => ({ value: unit, label: unit }))}
                error={errors.uom?.message}
              />
            )}
          />
          <TextField
            label="Cost per unit (₹)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            error={errors.costPrice?.message}
            {...form.register("costPrice", { valueAsNumber: true })}
          />
        </div>
        <TextareaField label="Description" rows={2} error={errors.description?.message} {...form.register("description")} />

        {!product && (
          <FieldSet className="rounded-xl border border-dashed p-4">
            <FieldLegend variant="label">Initial stock (optional)</FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Quantity on hand"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                error={errors.initialQuantity?.message}
                {...form.register("initialQuantity", { setValueAs: toOptionalNumber })}
              />
              <Controller
                control={form.control}
                name="initialLocation"
                render={({ field }) => (
                  <SelectField
                    label="Location"
                    value={field.value}
                    onChange={field.onChange}
                    options={locations.map((location) => ({ value: location.id, label: location.fullName }))}
                    error={errors.initialLocation?.message}
                  />
                )}
              />
            </div>
          </FieldSet>
        )}
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {product ? "Save changes" : "Create product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRowDTO | null;
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "New product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update the product details." : "Initial stock is booked as an inventory adjustment in the ledger."}
          </DialogDescription>
        </DialogHeader>
        {open && <ProductForm key={product?.id ?? "new"} product={product} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
