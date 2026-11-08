import {
  companyDateKey,
  companyTimeZone,
  shiftDateKey,
} from "@/common/helpers/company-timezone.helper";
import { expiryDateKey } from "@/modules/expiry-alerts/expiry-policy";

export function batchExpiryWindow(timeZone: string, now = new Date()) {
  const today = companyDateKey(now, companyTimeZone(timeZone));
  return {
    today,
    lastDay: shiftDateKey(today, 3),
    start: new Date(`${today}T00:00:00Z`),
    end: new Date(`${shiftDateKey(today, 4)}T00:00:00Z`),
  };
}

export function batchExpiryDays(
  value: Date | null,
  today: string,
): number | null {
  const key = expiryDateKey(value);
  return key
    ? Math.round(
        (Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
          86400000,
      )
    : null;
}
