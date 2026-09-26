import type { Metadata } from "next";
import { MoveHistoryView } from "./move-history-view";

export const metadata: Metadata = { title: "Move History" };

export default function MoveHistoryPage() {
  return <MoveHistoryView />;
}
