export const BUSINESS_TIME_ZONE = "America/Lima";

export function businessDateToInstant(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error("Fecha contable inválida");
  const date = new Date(`${day}T00:00:00-05:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    businessDateInputValue(date) !== day
  ) {
    throw new Error("Fecha contable inválida");
  }
  return date.toISOString();
}

export function businessDateInputValue(
  value: string | Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatBusinessDate(value: string | Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}
