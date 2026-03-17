export const PERU_VALIDATIONS = {
  phone: {
    regex: /^(\+51)?[\s]?(9\d{8}|\d{7,8})$/,
    format: '+51 999 999 999',
    example: '+51 999 999 999',
    error: 'Ingrese un numero de telefono valido (9 digitos para movil)',
  },
  mobile: {
    regex: /^9\d{8}$/,
    format: '999 999 999',
    example: '999 999 999',
    error: 'Ingrese un numero de celular valido (9 digitos)',
  },
  dni: {
    regex: /^\d{8}$/,
    format: '12345678',
    example: '12345678',
    error: 'El DNI debe tener 8 digitos',
  },
  ruc: {
    regex: /^\d{11}$/,
    format: '20123456789',
    example: '20123456789',
    error: 'El RUC debe tener 11 digitos',
  },
  email: {
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    format: 'email@dominio.com',
    example: 'juan@ejemplo.com',
    error: 'Ingrese un correo electronico valido',
  },
  textOnly: {
    regex: /^[a-zA-Z\sÑñáéíóúÁÉÍÓÚ]+$/,
    format: 'Solo letras',
    example: 'Juan Perez',
    error: 'Solo se permiten letras',
  },
  numbersOnly: {
    regex: /^\d+$/,
    format: 'Solo numeros',
    example: '123456',
    error: 'Solo se permiten numeros',
  },
  alphanumeric: {
    regex: /^[a-zA-Z0-9\s\-_]+$/,
    format: 'Letras y numeros',
    example: 'Producto 123',
    error: 'Solo se permiten letras y numeros',
  },
  positiveNumber: {
    regex: /^\d+(\.\d{1,2})?$/,
    format: 'Numero positivo',
    example: '99.99',
    error: 'Ingrese un numero positivo',
  },
} as const;

export function validatePhone(value: string): boolean {
  const cleaned = value.replace(/\s/g, '');
  return PERU_VALIDATIONS.phone.regex.test(cleaned) || PERU_VALIDATIONS.mobile.regex.test(cleaned);
}

export function validateDNI(value: string): boolean {
  return PERU_VALIDATIONS.dni.regex.test(value);
}

export function validateRUC(value: string): boolean {
  if (!PERU_VALIDATIONS.ruc.regex.test(value)) return false;
  
  const digits = value.split('').map(Number);
  const verifier = digits[10];
  const sum = digits
    .slice(0, 10)
    .map((d, i) => d * (11 - i))
    .reduce((a, b) => a + b, 0);
  const remainder = sum % 11;
  const checkDigit = remainder <= 1 ? 1 - remainder : 11 - remainder;
  
  return checkDigit === verifier;
}

export function validateEmail(value: string): boolean {
  return PERU_VALIDATIONS.email.regex.test(value);
}

export function validateTextOnly(value: string): boolean {
  return PERU_VALIDATIONS.textOnly.regex.test(value);
}

export function validateNumbersOnly(value: string): boolean {
  return PERU_VALIDATIONS.numbersOnly.regex.test(value);
}

export function validatePositiveNumber(value: string): boolean {
  return PERU_VALIDATIONS.positiveNumber.regex.test(value);
}

export function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.startsWith('51')) {
    const number = cleaned.slice(2);
    if (number.length === 9) {
      return `+51 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
    }
  }
  if (cleaned.length === 9) {
    return `+51 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return value;
}

export function formatDNI(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return cleaned.slice(0, 8);
}

export function formatRUC(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 11) return cleaned;
  return cleaned.slice(0, 11);
}

export function sanitizeInput(value: string): string {
  return value
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

export const INPUT_MAX_LENGTHS = {
  name: 100,
  lastName: 100,
  email: 255,
  phone: 15,
  dni: 8,
  ruc: 11,
  companyName: 150,
  address: 255,
  notes: 500,
  sku: 50,
  barcode: 50,
} as const;
