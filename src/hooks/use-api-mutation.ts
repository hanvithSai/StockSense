"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api-client";

interface Options<TVariables, TResult> {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  /** Query keys to refresh after success (defaults to everything, since stock touches many views). */
  invalidate?: QueryKey[];
  success?: string | ((result: TResult) => string);
  onSuccess?: (result: TResult) => void;
  /** Set to false when the caller maps errors itself (e.g. onto form fields). */
  toastErrors?: boolean;
}

export function useApiMutation<TVariables = void, TResult = unknown>(options: Options<TVariables, TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (result) => {
      if (options.invalidate) {
        await Promise.all(options.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      } else {
        await queryClient.invalidateQueries();
      }
      if (options.success) {
        toast.success(typeof options.success === "function" ? options.success(result) : options.success);
      }
      options.onSuccess?.(result);
    },
    onError: (error) => {
      if (options.toastErrors !== false) toast.error(errorMessage(error));
    },
  });
}
