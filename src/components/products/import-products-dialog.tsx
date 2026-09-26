"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Download, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage } from "@/lib/api-client";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { formatCurrency, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { productImportRowSchema } from "@/lib/validation/master";

type Field = "name" | "sku" | "category" | "uom" | "costPrice" | "description" | "initialQuantity" | "location";

const HEADER_ALIASES: Record<string, Field> = {
  name: "name",
  product: "name",
  "product name": "name",
  sku: "sku",
  code: "sku",
  "sku code": "sku",
  "internal reference": "sku",
  category: "category",
  "product category": "category",
  uom: "uom",
  unit: "uom",
  "unit of measure": "uom",
  cost: "costPrice",
  "cost price": "costPrice",
  costprice: "costPrice",
  "per unit cost": "costPrice",
  "unit cost": "costPrice",
  price: "costPrice",
  description: "description",
  notes: "description",
  "initial quantity": "initialQuantity",
  "initial stock": "initialQuantity",
  quantity: "initialQuantity",
  qty: "initialQuantity",
  "on hand": "initialQuantity",
  location: "location",
};

const TEMPLATE_HEADERS = ["name", "sku", "category", "uom", "cost", "description", "initial_quantity", "location"];
const TEMPLATE_ROWS = [
  ["Oak Coffee Table", "TABLE003", "Furniture", "Units", "6400", "Solid oak top", "12", "WH/Stock"],
  ["Stainless Screws M4", "SCREW002", "Hardware & Fasteners", "Box", "210", "M4 x 25 mm", "40", "WH/RackA"],
  ["Recycled Carton Box", "BOX003", "Packaging", "pcs", "32", "", "", ""],
];

interface PreviewRow {
  values: Record<string, unknown>;
  error: string | null;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; sku: string; message: string }[];
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/** Maps CSV rows to import fields using flexible header names, and validates each row. */
function buildPreview(text: string): { rows: PreviewRow[]; missing: Field[] } {
  const [header = [], ...body] = parseCsv(text);
  const columns = header.map((cell) => HEADER_ALIASES[cell.trim().toLowerCase().replace(/[_-]+/g, " ")] ?? null);
  const missing = (["name", "sku", "category", "uom"] as Field[]).filter((field) => !columns.includes(field));

  const rows = body.map((cells) => {
    const raw: Partial<Record<Field, string>> = {};
    columns.forEach((field, index) => {
      if (field) raw[field] = cells[index]?.trim() ?? "";
    });
    const values: Record<string, unknown> = {
      name: raw.name ?? "",
      sku: raw.sku ?? "",
      category: raw.category ?? "",
      uom: raw.uom ?? "",
      costPrice: toNumber(raw.costPrice) ?? 0,
      description: raw.description ?? "",
      initialQuantity: toNumber(raw.initialQuantity),
      location: raw.location || undefined,
    };
    const parsed = productImportRowSchema.safeParse(values);
    return { values, error: parsed.success ? null : parsed.error.issues[0].message };
  });
  return { rows, missing };
}

export function ImportProductsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; missing: Field[] } | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [createCategories, setCreateCategories] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setFileName(null);
    setPreview(null);
    setResult(null);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a .csv file (Excel: File → Save As → CSV)");
      return;
    }
    setFileName(file.name);
    setPreview(buildPreview(await file.text()));
    setResult(null);
  }

  const valid = preview?.rows.filter((row) => !row.error) ?? [];
  const invalid = (preview?.rows.length ?? 0) - valid.length;

  async function runImport() {
    if (!valid.length) return;
    setImporting(true);
    try {
      const report = await api<ImportResult>("/api/products/import", {
        method: "POST",
        body: { rows: valid.map((row) => row.values), updateExisting, createCategories },
      });
      setResult(report);
      await queryClient.invalidateQueries();
      toast.success(`Import finished: ${report.created} created, ${report.updated} updated`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> Import products from CSV
          </DialogTitle>
          <DialogDescription>
            Bring your existing spreadsheet: products are matched by SKU, categories by name, and initial stock is booked in the ledger.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Created", value: result.created, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "Updated", value: result.updated, tone: "text-sky-600 dark:text-sky-400" },
                { label: "Skipped (existing SKU)", value: result.skipped, tone: "text-muted-foreground" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border p-3">
                  <p className={cn("text-2xl font-semibold tabular", item.tone)}>{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="mb-2 flex items-center gap-2 font-medium text-destructive">
                  <TriangleAlert className="size-4" /> {result.errors.length} row{result.errors.length === 1 ? "" : "s"} could not be imported
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {result.errors.map((error) => (
                    <li key={`${error.row}-${error.sku}`}>
                      Row {error.row} <span className="font-mono">{error.sku}</span>: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : !preview ? (
          <div className="space-y-4">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void readFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="size-6" />
              </span>
              <span className="font-medium">Drop a CSV file here, or click to browse</span>
              <span className="text-xs text-muted-foreground">
                Columns: name, sku, category, uom, cost, description, initial_quantity, location
              </span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
            </label>
            <Button variant="link" className="px-0" onClick={() => downloadCsv("stocksense-products-template.csv", TEMPLATE_HEADERS, TEMPLATE_ROWS)}>
              <Download /> Download a template
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{fileName}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{preview.rows.length} rows</span>
              <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">{valid.length} ready</span>
              {invalid > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{invalid} with issues</span>}
            </div>
            {preview.missing.length > 0 && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Missing required columns: {preview.missing.join(", ")}. Download the template to see the expected format.
              </p>
            )}
            <ScrollArea className="h-72 rounded-xl border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Initial qty</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.map((row, index) => (
                    <tr key={index} className={cn(row.error && "bg-destructive/5")}>
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular">{index + 2}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{String(row.values.name) || "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {String(row.values.sku).toUpperCase() || "—"} · {String(row.values.uom) || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2">{String(row.values.category) || "—"}</td>
                      <td className="px-3 py-2 text-right tabular">{formatCurrency(Number(row.values.costPrice) || 0)}</td>
                      <td className="px-3 py-2 text-right tabular">
                        {row.values.initialQuantity === undefined ? "—" : formatQty(Number(row.values.initialQuantity))}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.error ? (
                          <span className="flex items-start gap-1 text-destructive">
                            <CircleX className="mt-0.5 size-3.5 shrink-0" /> {row.error}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CircleCheck className="size-3.5" /> Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={createCategories} onCheckedChange={(checked) => setCreateCategories(checked === true)} />
                Create missing categories
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={updateExisting} onCheckedChange={(checked) => setUpdateExisting(checked === true)} />
                Update products whose SKU already exists
              </Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset} disabled={importing}>
                Choose another file
              </Button>
              <Button onClick={runImport} disabled={importing || !valid.length}>
                {importing && <Spinner />}
                Import {valid.length} product{valid.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
