import type { Metadata } from "next";
import { PrintDocument } from "./print-document";

export const metadata: Metadata = { title: "Print" };

export default async function PrintOperationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintDocument id={id} />;
}
