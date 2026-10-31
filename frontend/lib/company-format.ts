export function validCompanyZone(value?: string | null): string {
  try {
    new Intl.DateTimeFormat("es-PE", {
      timeZone: value ?? "America/Lima",
    }).format();
    return value ?? "America/Lima";
  } catch {
    return "America/Lima";
  }
}

export function companyDateLabel(
  value: string | Date | null | undefined,
  zone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
    timeZone: validCompanyZone(zone),
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function companyDayKey(value: string | Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: validCompanyZone(zone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
