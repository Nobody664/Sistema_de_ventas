"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { sessionScope } from "@/lib/session-contract";

export function useSessionQueryReady(): boolean {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.isLoading);
  const scope = sessionScope(user);
  const authenticated = !!user;
  const [readyScope, setReadyScope] = useState<string | null>(null);
  // Espera un render tras la limpieza de caché que provoca el cambio de identidad.
  useEffect(() => {
    setReadyScope(!loading && authenticated ? scope : null);
  }, [loading, scope, authenticated]);
  return !loading && authenticated && readyScope === scope;
}
