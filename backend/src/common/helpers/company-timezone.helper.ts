const DEFAULT_ZONE = "America/Lima";
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

export function companyTimeZone(value?: string | null): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value ?? DEFAULT_ZONE }).format();
    return value ?? DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

export function companyDateKey(date: Date, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function companyMidnight(key: string, timeZone: string): Date {
  const wallTime = Date.parse(`${key}T00:00:00Z`);
  let instant = wallTime;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) =>
      Number(parts.find((entry) => entry.type === type)!.value);
    const rendered = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    const difference = wallTime - rendered;
    if (difference === 0) return new Date(instant);
    instant += difference;
  }
  // Algunas transiciones omiten la medianoche; se busca el primer instante del día local.
  let lower = wallTime - 36 * 3600000;
  let upper = wallTime + 36 * 3600000;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (companyDateKey(new Date(middle), timeZone) < key) lower = middle + 1;
    else upper = middle;
  }
  return new Date(lower);
}

export function companyDay(date: Date, timeZone: string) {
  const key = companyDateKey(date, timeZone);
  return {
    key,
    start: companyMidnight(key, timeZone),
    end: companyMidnight(shiftDateKey(key, 1), timeZone),
  };
}
