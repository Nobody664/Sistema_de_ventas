import { BadRequestException } from "@nestjs/common";
import { ProductExpiryProfile } from "@prisma/client";
import {
  companyDateKey,
  companyTimeZone,
  shiftDateKey,
} from "@/common/helpers/company-timezone.helper";

export type ExpiryStage = "EARLY" | "WARNING" | "URGENT" | "TODAY" | "EXPIRED";
export interface ExpiryPolicy {
  expiryProfile: ProductExpiryProfile;
  expiryWarningDays: number | null;
}

export function validateExpiryPolicy(
  profile: ProductExpiryProfile,
  warningDays?: number | null,
): ExpiryPolicy {
  if (!Object.values(ProductExpiryProfile).includes(profile))
    throw new BadRequestException("Perfil de vigencia inválido");
  if (profile === "CUSTOM") {
    if (
      !Number.isSafeInteger(warningDays) ||
      warningDays! < 1 ||
      warningDays! > 3650
    )
      throw new BadRequestException(
        "El aviso personalizado debe tener entre 1 y 3650 días",
      );
    return { expiryProfile: profile, expiryWarningDays: warningDays! };
  }
  if (warningDays != null)
    throw new BadRequestException(
      "Los días personalizados solo se usan con el perfil personalizado",
    );
  return { expiryProfile: profile, expiryWarningDays: null };
}

export function expiryDateKey(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null;
}

export function subtractCalendarMonths(key: string, months: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}

export function expiryState(
  policy: ExpiryPolicy,
  value: Date | string | null | undefined,
  timeZone: string,
  now = new Date(),
) {
  const dateKey = expiryDateKey(value);
  const today = companyDateKey(now, companyTimeZone(timeZone));
  if (!dateKey)
    return {
      dateKey: null,
      today,
      daysLeft: null,
      warningStartsOn: null,
      stage: null,
      reminderKey: null,
    };
  const daysLeft = Math.round(
    (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
  const warningStartsOn =
    policy.expiryProfile === "LONG_LIFE"
      ? subtractCalendarMonths(dateKey, 3)
      : shiftDateKey(
          dateKey,
          -(policy.expiryProfile === "PERISHABLE"
            ? 3
            : policy.expiryProfile === "CUSTOM"
              ? policy.expiryWarningDays!
              : 30),
        );
  const stage: ExpiryStage | null =
    daysLeft < 0
      ? "EXPIRED"
      : daysLeft === 0
        ? "TODAY"
        : today < warningStartsOn
          ? null
          : daysLeft <= 7
            ? "URGENT"
            : daysLeft <= 30
              ? "WARNING"
              : "EARLY";
  const reminderKey =
    stage === null
      ? null
      : stage === "EARLY"
    ? `week:${Math.floor((Date.parse(`${today}T00:00:00Z`) / 86400000 + 3) / 7)}`
        : `day:${today}`;
  return { dateKey, today, daysLeft, warningStartsOn, stage, reminderKey };
}
