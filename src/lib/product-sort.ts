import type { ProductRowDTO } from "./types";

export const PRODUCT_SORT_KEYS = ["name", "costPrice", "onHand", "free", "forecast", "value"] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export interface ProductSort {
  key: ProductSortKey;
  direction: "asc" | "desc";
}

export const DEFAULT_PRODUCT_SORT: ProductSort = { key: "name", direction: "asc" };

/** Sorts product rows by one column; ties fall back to the product name. */
export function sortProducts(rows: ProductRowDTO[], { key, direction }: ProductSort): ProductRowDTO[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const diff = key === "name" ? a.name.localeCompare(b.name) : a[key] - b[key];
    return diff * factor || a.name.localeCompare(b.name);
  });
}

/** Query string form: `onHand` (ascending) or `-onHand` (descending). */
export function serializeProductSort({ key, direction }: ProductSort): string {
  return direction === "desc" ? `-${key}` : key;
}

export function parseProductSort(value: string | null | undefined): ProductSort {
  if (!value) return DEFAULT_PRODUCT_SORT;
  const key = value.replace(/^-/, "");
  if (!PRODUCT_SORT_KEYS.includes(key as ProductSortKey)) return DEFAULT_PRODUCT_SORT;
  return { key: key as ProductSortKey, direction: value.startsWith("-") ? "desc" : "asc" };
}
