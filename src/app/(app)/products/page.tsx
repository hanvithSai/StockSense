import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsView } from "./products-view";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsView />
    </Suspense>
  );
}
