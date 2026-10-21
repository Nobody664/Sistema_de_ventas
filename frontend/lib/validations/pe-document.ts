export function isValidDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = ruc.split("").map(Number);
  const sum = weights.reduce(
    (acc, weight, index) => acc + weight * digits[index],
    0,
  );
  const remainder = 11 - (sum % 11);
  const checkDigit = remainder === 10 ? 0 : remainder === 11 ? 1 : remainder;

  return checkDigit === digits[10];
}

export function isValidPeruPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 12;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
