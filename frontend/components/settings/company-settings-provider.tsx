"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  companyDateLabel,
  companyDayKey,
  validCompanyZone,
} from "@/lib/company-format";
import type { CompanySettingsData } from "@/types/company-settings";
import { useSessionQueryReady } from "@/hooks/use-session-query-ready";
import { useAuthStore } from "@/stores/auth.store";

const CompanyContext = createContext<CompanySettingsData | null>(null);

export function CompanySettingsProvider({
  initialCompany,
  children,
}: {
  initialCompany: CompanySettingsData | null;
  children: ReactNode;
}) {
  const ready = useSessionQueryReady();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.isLoading);
  const canUseInitial = user ? user.companyId === initialCompany?.id : loading;
  const { data } = useQuery({
    queryKey: ["company-current"],
    initialData: canUseInitial ? (initialCompany ?? undefined) : undefined,
    enabled: ready,
    queryFn: () => apiFetch<CompanySettingsData>("/companies/current"),
    staleTime: 60_000,
  });
  return (
    <CompanyContext.Provider value={data ?? null}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyFormat() {
  const company = useContext(CompanyContext);
  const timeZone = validCompanyZone(company?.timezone);
  return {
    company,
    timeZone,
    currency: company?.currency ?? "PEN",
    date: (
      value: string | Date | null | undefined,
      options?: Intl.DateTimeFormatOptions,
    ) => companyDateLabel(value, timeZone, options),
    dateTime: (value: string | Date | null | undefined) =>
      companyDateLabel(value, timeZone, { hour: "2-digit", minute: "2-digit" }),
    dayKey: (value: string | Date) => companyDayKey(value, timeZone),
  };
}
