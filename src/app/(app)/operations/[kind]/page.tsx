import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OperationList } from "@/components/operations/operation-list";
import { OPERATION_META, SLUG_TO_TYPE } from "@/lib/constants";

type Props = { params: Promise<{ kind: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = SLUG_TO_TYPE[(await params).kind];
  return { title: type ? OPERATION_META[type].plural : "Operations" };
}

export default async function OperationsPage({ params }: Props) {
  const type = SLUG_TO_TYPE[(await params).kind];
  if (!type) notFound();
  return (
    <Suspense>
      <OperationList key={type} type={type} />
    </Suspense>
  );
}
