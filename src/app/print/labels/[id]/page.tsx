import type { Metadata } from "next";
import { LabelSheet } from "./label-sheet";

export const metadata: Metadata = { title: "Barcode labels" };

export default async function LabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const copies = Number(typeof query.copies === "string" ? query.copies : 12);
  return <LabelSheet id={id} copies={Number.isInteger(copies) && copies > 0 && copies <= 60 ? copies : 12} />;
}
