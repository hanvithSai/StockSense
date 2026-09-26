"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/table-skeleton";
import { applyServerErrors, TextareaField, TextField } from "@/components/forms/fields";
import { useSession } from "@/components/layout/session-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useCategories } from "@/hooks/use-reference-data";
import { api } from "@/lib/api-client";
import type { CategoryDTO } from "@/lib/types";
import { categorySchema, type CategoryInput } from "@/lib/validation/master";

function CategoryForm({ category, onDone }: { category: CategoryDTO | null; onDone: () => void }) {
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: category?.name ?? "", description: category?.description ?? "" },
  });
  const save = useApiMutation<CategoryInput>({
    mutationFn: (values) =>
      category
        ? api(`/api/categories/${category.id}`, { method: "PATCH", body: values })
        : api("/api/categories", { method: "POST", body: values }),
    invalidate: [["categories"], ["products"]],
    success: category ? "Category updated" : "Category created",
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
        <TextField label="Name" required placeholder="Raw Materials" error={errors.name?.message} {...form.register("name")} />
        <TextareaField label="Description" rows={2} error={errors.description?.message} {...form.register("description")} />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {category ? "Save changes" : "Create category"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CategoriesView() {
  const { can } = useSession();
  const canWrite = can("master:write");
  const { data, isLoading } = useCategories();
  const [editing, setEditing] = useState<CategoryDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);
  const remove = useApiMutation<string>({
    mutationFn: (id) => api(`/api/categories/${id}`, { method: "DELETE" }),
    invalidate: [["categories"]],
    success: "Category deleted",
  });

  return (
    <>
      <PageHeader
        title="Product categories"
        description="Group products for filtering, reporting and dashboard insights."
        actions={
          canWrite && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> New category
            </Button>
          )
        }
      />
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
              <TableHead className="text-right">Products</TableHead>
              {canWrite && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={4} />
            ) : !data?.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <EmptyState icon={Tags} title="No categories yet" description="Create categories before adding products." />
                </TableCell>
              </TableRow>
            ) : (
              data.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{category.description || "—"}</TableCell>
                  <TableCell className="text-right tabular">
                    <Link href={`/stock?category=${category.id}`} className="hover:underline">
                      {category.productCount}
                    </Link>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(category)} aria-label={`Delete ${category.name}`}>
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New category" : "Edit category"}</DialogTitle>
            <DialogDescription>Category names must be unique.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <CategoryForm key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Categories that still contain products cannot be deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
