"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationsStore } from "@/store/notifications-store";
import { setQueryScope } from "@/lib/query-scope";
import { sessionScope } from "@/lib/session-contract";

export function AuthHydrator() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const resetNotifications = useNotificationsStore((state) => state.reset);
  const scope = sessionScope(user);
  const previousScope = useRef(scope);

  setQueryScope(scope);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (previousScope.current === scope) return;

    previousScope.current = scope;
    void queryClient.cancelQueries();
    queryClient.clear();
    resetNotifications();
  }, [scope, queryClient, resetNotifications]);

  return null;
}
