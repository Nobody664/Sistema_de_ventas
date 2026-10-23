"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  hasFeature,
  hasModule,
  type PlanCapabilities,
} from "@/lib/plan-capabilities";

interface PlanCapabilitiesContextValue {
  capabilities: PlanCapabilities | null;
  planCode: string;
  isLoading: boolean;
  can: (module: string) => boolean;
  canFeature: (feature: string) => boolean;
}

const PlanCapabilitiesContext =
  createContext<PlanCapabilitiesContextValue | null>(null);

interface PlanCapabilitiesProviderProps {
  capabilities: PlanCapabilities | null;
  children: ReactNode;
}

export function PlanCapabilitiesProvider({
  capabilities,
  children,
}: PlanCapabilitiesProviderProps) {
  const value = useMemo<PlanCapabilitiesContextValue>(
    () => ({
      capabilities,
      planCode: capabilities?.planCode ?? "FREE",
      isLoading: false,
      can: (module: string) => hasModule(capabilities, module),
      canFeature: (feature: string) => hasFeature(capabilities, feature),
    }),
    [capabilities],
  );

  return (
    <PlanCapabilitiesContext.Provider value={value}>
      {children}
    </PlanCapabilitiesContext.Provider>
  );
}

export function usePlanCapabilities(): PlanCapabilitiesContextValue {
  const context = useContext(PlanCapabilitiesContext);
  if (!context) {
    return {
      capabilities: null,
      planCode: "FREE",
      isLoading: false,
      can: () => true,
      canFeature: () => true,
    };
  }
  return context;
}
