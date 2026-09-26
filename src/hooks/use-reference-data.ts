"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  CategoryDTO,
  LocationDTO,
  ProductOptionDTO,
  UserOptionDTO,
  WarehouseDTO,
} from "@/lib/types";

/** Shared, cached master data used by filters and forms across pages. */

export function useWarehouses() {
  return useQuery({ queryKey: ["warehouses"], queryFn: () => api<WarehouseDTO[]>("/api/warehouses") });
}

export function useLocations() {
  return useQuery({ queryKey: ["locations"], queryFn: () => api<LocationDTO[]>("/api/locations") });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => api<CategoryDTO[]>("/api/categories") });
}

export function useProductOptions() {
  return useQuery({
    queryKey: ["products", "options"],
    queryFn: () => api<ProductOptionDTO[]>("/api/products?options=1"),
  });
}

export function useUserOptions() {
  return useQuery({ queryKey: ["users", "options"], queryFn: () => api<UserOptionDTO[]>("/api/users?options=1") });
}
