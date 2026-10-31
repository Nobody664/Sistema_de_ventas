import type { ProductExpiryProfile } from "@/types/generated";

export type ExpiryStage = "EARLY" | "WARNING" | "URGENT" | "TODAY" | "EXPIRED";

export interface ExpiryInspectionSource {
  batchId: string | null;
  batchNumber: string | null;
  quantity: string;
  dateKey: string | null;
  daysLeft: number | null;
  stage: ExpiryStage | null;
  warningStartsOn: string | null;
  reminderKey: string | null;
}

export interface ExpiryInspection {
  checkedAt: string;
  timeZone: string;
  profile: ProductExpiryProfile;
  warningDays: number;
  warningMonths: number | null;
  monitored: boolean;
  totalBatches: number;
  truncated: boolean;
  sources: ExpiryInspectionSource[];
}

export const EXPIRY_PROFILE_OPTIONS: Array<{
  value: ProductExpiryProfile;
  label: string;
  description: string;
}> = [
  {
    value: "PERISHABLE",
    label: "Perecedero",
    description: "Lácteos, carnes y productos frescos. Aviso 3 días antes.",
  },
  {
    value: "STANDARD",
    label: "Estándar",
    description: "Abarrotes y consumo habitual. Aviso 30 días antes.",
  },
  {
    value: "LONG_LIFE",
    label: "Larga duración",
    description: "Conservas, atunes y enlatados. Aviso 3 meses antes.",
  },
  {
    value: "CUSTOM",
    label: "Personalizado",
    description: "Define tú cuántos días antes quieres el aviso.",
  },
];

export const EXPIRY_STAGE_LABELS: Record<ExpiryStage, string> = {
  EARLY: "Aviso temprano",
  WARNING: "Por vencer",
  URGENT: "Urgente",
  TODAY: "Vence hoy",
  EXPIRED: "Vencido",
};

export function expiryProfileOption(profile: ProductExpiryProfile) {
  return (
    EXPIRY_PROFILE_OPTIONS.find((option) => option.value === profile) ??
    EXPIRY_PROFILE_OPTIONS[1]
  );
}

export function expiryWarningLabel(
  profile: ProductExpiryProfile,
  customDays?: number | null,
): string {
  if (profile === "PERISHABLE") return "3 días antes";
  if (profile === "STANDARD") return "30 días antes";
  if (profile === "LONG_LIFE") return "3 meses antes";
  return customDays && customDays > 0
    ? `${customDays} día${customDays === 1 ? "" : "s"} antes`
    : "Define los días de aviso";
}

export function expiryStageTone(stage: ExpiryStage | null): string {
  if (stage === "EXPIRED") return "bg-red-500/15 text-red-700";
  if (stage === "TODAY" || stage === "URGENT")
    return "bg-orange-500/15 text-orange-700";
  if (stage === "WARNING") return "bg-amber-500/15 text-amber-700";
  if (stage === "EARLY") return "bg-blue-500/15 text-blue-700";
  return "bg-slate-500/10 text-slate-600";
}

export function expiryDaysLabel(daysLeft: number | null): string {
  if (daysLeft == null) return "Sin fecha de vencimiento";
  if (daysLeft < 0) return `Venció hace ${Math.abs(daysLeft)} día(s)`;
  if (daysLeft === 0) return "Vence hoy";
  return `Vence en ${daysLeft} día(s)`;
}
