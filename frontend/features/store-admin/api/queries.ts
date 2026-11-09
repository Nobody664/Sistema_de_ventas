"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { useCommerceContext } from "../components/commerce-shell";
import { storeAdminKeys } from "./contracts";

export function useAdminQuery<T>(resource: string, enabled = true) {
  const { context, userId } = useCommerceContext();
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: [...storeAdminKeys(context.company.id, userId).all, resource],
    queryFn: ({ signal }) =>
      apiFetch<T>(`/store-admin/${resource}`, { signal }),
    enabled:
      enabled &&
      ready &&
      user?.id === userId &&
      user?.companyId === context.company.id,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useAdminWrite<T = unknown>() {
  const { context, userId } = useCommerceContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      resource,
      body,
      method = "PATCH",
    }: {
      resource: string;
      body: unknown;
      method?: "POST" | "PATCH";
    }) => {
      const result = await apiFetch<T>(`/store-admin/${resource}`, {
        method,
        body: JSON.stringify(body),
      });
      if (
        result &&
        typeof result === "object" &&
        "updated" in result &&
        result.updated === false
      )
        throw new Error(
          "El registro ya no está disponible para esta operación. Actualiza la página.",
        );
      return result;
    },
    onSuccess: async (_data, variables) => {
      if (typeof window !== "undefined")
        window.dispatchEvent(
          new CustomEvent("store-admin:mutation", {
            detail: variables.resource,
          }),
        );
      await client.invalidateQueries({
        queryKey: storeAdminKeys(context.company.id, userId).all,
      });
    },
    retry: false,
  });
}
