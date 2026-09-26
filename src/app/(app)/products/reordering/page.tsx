import type { Metadata } from "next";
import { ReorderingView } from "./reordering-view";

export const metadata: Metadata = { title: "Reordering Rules" };

export default function ReorderingPage() {
  return <ReorderingView />;
}
