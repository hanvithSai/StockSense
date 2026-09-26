"use client";

import { useQuery } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { useSession } from "@/components/layout/session-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocations, useProductOptions, useUserOptions, useWarehouses } from "@/hooks/use-reference-data";
import { api, ApiError, qs } from "@/lib/api-client";
import { operationPath, type OperationType } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { manageCapability } from "@/lib/permissions";
import type { OperationDTO } from "@/lib/types";
import { OperationForm, type OperationPrefill } from "./operation-form";

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

/** Master data the form needs before it can build its default values. */
function useFormReady() {
  const results = [useLocations(), useWarehouses(), useProductOptions(), useUserOptions()];
  return results.every((result) => result.isSuccess);
}

export function NewOperation({ type, prefill, copyFrom }: { type: OperationType; prefill: OperationPrefill; copyFrom?: string }) {
  const { can } = useSession();
  const ready = useFormReady();
  const template = useQuery({
    queryKey: ["operation", copyFrom],
    queryFn: () => api<OperationDTO>(`/api/operations/${copyFrom}`),
    enabled: Boolean(copyFrom),
  });
  if (!can(manageCapability(type))) redirect(operationPath(type));
  if (!ready || (copyFrom && template.isLoading)) return <FormSkeleton />;
  const source = template.data?.type === type ? template.data : undefined;
  return <OperationForm type={type} prefill={prefill} template={source} />;
}

export function OperationDetail({ type, id }: { type: OperationType; id: string }) {
  const ready = useFormReady();
  const { data, error } = useQuery({
    queryKey: ["operation", id],
    queryFn: () => api<OperationDTO>(`/api/operations/${id}${qs({ today: todayISO() })}`),
  });

  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
  if (data && data.type !== type) redirect(operationPath(data.type, data.id));
  if (!data || !ready) return <FormSkeleton />;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Remount the form whenever the server state changes so it always reflects the saved record. */}
      <OperationForm key={`${data.id}-${data.updatedAt}`} type={type} operation={data} />
      <ActivityTimeline entityType="operation" entityId={data.id} className="self-start xl:sticky xl:top-20 xl:mt-10" />
    </div>
  );
}
