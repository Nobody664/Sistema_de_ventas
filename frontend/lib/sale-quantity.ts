const FRACTIONAL_BASE_UNITS = new Set(["KG", "LT", "MT"]);

export function quantityStep(
  baseUnit: string,
  presentationId?: string | null,
): number {
  if (presentationId) return 1;
  return FRACTIONAL_BASE_UNITS.has(baseUnit.toUpperCase()) ? 0.001 : 1;
}

export function maxSaleQuantity(
  stock: number,
  factor: number,
  baseUnit: string,
  presentationId?: string | null,
): number {
  const available = factor > 0 ? stock / factor : stock;
  if (!Number.isFinite(available) || available <= 0) return 0;
  if (quantityStep(baseUnit, presentationId) >= 1) return Math.floor(available);
  return Math.floor(available * 1000) / 1000;
}

export function clampSaleQuantity(
  value: number,
  step: number,
  max: number,
): number {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  const capped = Math.min(value, max);
  const rounded =
    step >= 1 ? Math.floor(capped) : Math.round(capped * 1000) / 1000;
  return rounded > 0 ? rounded : 0;
}

export function normalizeSaleQuantity(
  value: number,
  stock: number,
  factor: number,
  baseUnit: string,
  presentationId?: string | null,
): number {
  const step = quantityStep(baseUnit, presentationId);
  const max = maxSaleQuantity(stock, factor, baseUnit, presentationId);
  return clampSaleQuantity(value, step, max);
}

export function formatSaleQuantity(value: number, step: number): string {
  if (!Number.isFinite(value)) return "0";
  return step >= 1
    ? String(Math.trunc(value))
    : String(Math.round(value * 1000) / 1000);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
