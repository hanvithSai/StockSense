import type { Metadata } from "next";
import { Suspense } from "react";
import { LocationsView } from "./locations-view";

export const metadata: Metadata = { title: "Locations" };

export default function LocationsPage() {
  return (
    <Suspense>
      <LocationsView />
    </Suspense>
  );
}
