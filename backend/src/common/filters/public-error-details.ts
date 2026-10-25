export interface PublicErrorDetails {
  limit?: number;
  used?: number;
  remaining?: number;
  current?: number;
  resource?: string;
  currentPlan?: string;
  requiredPlan?: string;
  planName?: string;
  period?: string;
  upgradeUrl?: string;
  modules?: string[];
  features?: string[];
}

export function publicErrorDetails(
  input: Record<string, unknown>,
): PublicErrorDetails {
  const details: PublicErrorDetails = {};
  for (const field of ["limit", "used", "remaining", "current"] as const) {
    const value = input[field];
    if (
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= (field === "limit" ? -1 : 0)
    )
      details[field] = value;
  }
  for (const field of [
    "resource",
    "currentPlan",
    "requiredPlan",
    "planName",
  ] as const) {
    const value = input[field];
    if (
      typeof value === "string" &&
      value.length <= 200 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    )
      details[field] = value;
  }
  if (
    typeof input.period === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)
  )
    details.period = input.period;
  if (
    typeof input.upgradeUrl === "string" &&
    input.upgradeUrl.length <= 256 &&
    /^\/[a-zA-Z0-9/_-]*$/.test(input.upgradeUrl) &&
    !input.upgradeUrl.startsWith("//")
  )
    details.upgradeUrl = input.upgradeUrl;
  for (const field of ["modules", "features"] as const) {
    const value = input[field];
    if (
      Array.isArray(value) &&
      value.length <= 100 &&
      value.every(
        (item): item is string =>
          typeof item === "string" &&
          item.length <= 128 &&
          /^[a-zA-Z0-9_.:-]+$/.test(item),
      )
    )
      details[field] = value;
  }
  return details;
}
