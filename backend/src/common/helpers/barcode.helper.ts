const GTIN_PATTERN = /^\d{8}$|^\d{12,14}$/;

export function isValidGtin(value: string): boolean {
  if (!GTIN_PATTERN.test(value)) return false;

  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  let sum = 0;
  let weight = 3;

  for (let index = digits.length - 1; index >= 0; index--) {
    sum += digits[index] * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function toGtin14(value: string): string | null {
  if (!isValidGtin(value)) return null;
  return value.padStart(14, "0");
}

export function barcodeLookupCandidates(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>([trimmed]);
  const gtin = toGtin14(trimmed);
  if (!gtin) return [...candidates];

  candidates.add(gtin);

  for (const length of [13, 12, 8]) {
    if (
      gtin.length > length &&
      gtin.startsWith("0".repeat(gtin.length - length))
    ) {
      candidates.add(gtin.slice(-length));
    }
  }

  const withoutLeadingZeros = gtin.replace(/^0+/, "");
  if (withoutLeadingZeros.length >= 8) {
    candidates.add(withoutLeadingZeros);
  }

  return [...candidates];
}
