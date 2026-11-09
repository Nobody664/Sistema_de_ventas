"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationsStore } from "@/store/notifications-store";
import { storeAdminKeys } from "./contracts";
import { shouldReconcileCommerce } from "./operations";

export function useCommerceReconciliation(companyId: string, userId: string) {
  const client = useQueryClient();
  useEffect(
    () =>
      useNotificationsStore.subscribe((state, previous) => {
        if (shouldReconcileCommerce(state, previous, companyId))
          void client.invalidateQueries({
            queryKey: storeAdminKeys(companyId, userId).all,
          });
      }),
    [client, companyId, userId],
  );
}
