import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewOperation } from "@/components/operations/operation-pages";
import { OPERATION_META, SLUG_TO_TYPE } from "@/lib/constants";

type Props = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = SLUG_TO_TYPE[(await params).kind];
  return { title: type ? `New ${OPERATION_META[type].label}` : "Operations" };
}

export default async function NewOperationPage({ params, searchParams }: Props) {
  const type = SLUG_TO_TYPE[(await params).kind];
  if (!type) notFound();
  const query = await searchParams;
  const text = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const quantity = Number(text("quantity"));
  return (
    <NewOperation
      type={type}
      copyFrom={text("from")}
      prefill={{
        product: text("product"),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
        location: text("location"),
      }}
    />
  );
}
