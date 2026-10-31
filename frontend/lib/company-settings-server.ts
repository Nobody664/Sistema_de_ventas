import { cache } from "react";
import { serverApiFetch } from "./server-api";
import type { CompanySettingsData } from "@/types/company-settings";

export const getCompanySettings = cache(async (accessToken?: string) =>
  serverApiFetch<CompanySettingsData>("/companies/current", accessToken),
);
