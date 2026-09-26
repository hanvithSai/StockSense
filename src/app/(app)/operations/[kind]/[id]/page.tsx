import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperationDetail } from "@/components/operations/operation-pages";
import { OPERATION_META, SLUG_TO_TYPE } from "@/lib/constants";

type Props = { params: Promise<{ kind: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = SLUG_TO_TYPE[(await params).kind];
  return { title: type ? OPERATION_META[type].label : "Operation" };
}

export default async function OperationPage({ params }: Props) {
  const { kind, id } = await params;
  const type = SLUG_TO_TYPE[kind];
  if (!type) notFound();
  return <OperationDetail type={type} id={id} />;
}
