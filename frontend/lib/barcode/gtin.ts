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
