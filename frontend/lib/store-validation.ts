import { z } from "zod";

const plain = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}: mínimo ${min} caracteres`)
    .max(max, `${label}: máximo ${max} caracteres`)
    .refine(
      (value) => !/[<>\u0000-\u001f\u007f]/.test(value),
      "Usa texto sin etiquetas ni caracteres de control",
    );
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Escribe un correo válido")
  .max(200, "Máximo 200 caracteres");
const password = z
  .string()
  .min(8, "Usa al menos 8 caracteres")
  .max(256, "Máximo 256 caracteres");
const phone = z
  .string()
  .trim()
  .regex(
    /^\+?[0-9 ()-]{7,20}$/,
    "Escribe un teléfono válido de 7 a 20 caracteres",
  );
const token = z
  .string()
  .regex(
    /^[a-f0-9]{64}$/,
    "El enlace no es válido o ha vencido. Solicita uno nuevo.",
  );
const confirmation = {
  passwordConfirmation: z.string().min(1, "Repite tu contraseña"),
};
const confirmed = (data: { password: string; passwordConfirmation: string }) =>
  data.password === data.passwordConfirmation;
const confirmationError = {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirmation"],
};

export const storeFormSchemas = {
  "auth/login": z.object({ email, password }),
  "auth/register": z
    .object({
      email,
      password,
      firstName: plain(2, 100, "Nombres"),
      lastName: plain(2, 100, "Apellidos"),
      acceptTerms: z.literal(true, {
        message: "Acepta el tratamiento de datos para continuar",
      }),
      ...confirmation,
    })
    .refine(confirmed, confirmationError),
  "auth/forgot-password": z.object({ email }),
  "auth/resend": z.object({ email }),
  "auth/verify": z.object({ token }),
  "auth/reset-password": z
    .object({ token, password, ...confirmation })
    .refine(confirmed, confirmationError),
  me: z.object({
    firstName: plain(2, 100, "Nombres"),
    lastName: plain(2, 100, "Apellidos"),
    documentValue: z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos"),
    phone,
  }),
  "me/addresses": z.object({
    label: plain(1, 60, "Nombre"),
    recipient: plain(2, 160, "Destinatario"),
    phone,
    street: plain(5, 240, "Dirección"),
    district: z.string().regex(/^\d{6}$/, "El ubigeo debe tener 6 dígitos"),
    reference: plain(0, 240, "Referencia").optional(),
    isDefault: z.boolean(),
  }),
};

export const storeReasonSchema = z.object({ reason: plain(5, 500, "Motivo") });
const boundedNumber = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const storeAdminSchemas = {
  settings: z.object({
    title: plain(0, 100, "Nombre comercial"),
    description: z
      .string()
      .trim()
      .max(1000)
      .refine(
        (value) =>
          !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
        "Descripción: usa texto sin etiquetas",
      ),
    enabled: z.boolean(),
    registrationEnabled: z.boolean(),
  }),
  commerce: z.object({
    checkoutEnabled: z.boolean(),
    pricesIncludeTax: z.boolean(),
    taxRate: boundedNumber(0, 100).refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
      "El impuesto admite 2 decimales",
    ),
    reservationMinutes: boundedNumber(5, 1440).int(),
  }),
  "payment-methods": z.object({
    code: z.enum(["TRANSFER", "YAPE", "PLIN", "CASH_ON_PICKUP", "MERCADOPAGO"]),
    label: plain(2, 80, "Nombre de pago"),
    instructions: z
      .string()
      .trim()
      .max(2000)
      .refine(
        (value) =>
          !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
        "Instrucciones: usa texto sin etiquetas",
      ),
    enabled: z.boolean(),
  }),
  "shipping-methods": z
    .object({
      kind: z.enum(["PICKUP", "DELIVERY"]),
      label: plain(2, 80, "Nombre de entrega"),
      fee: boundedNumber(0, 100000).refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
        "La tarifa admite 2 decimales",
      ),
      districts: z
        .array(z.string().regex(/^\d{6}$/, "Cada ubigeo debe tener 6 dígitos"))
        .max(200),
      pickupAddress: plain(0, 240, "Dirección de retiro").optional(),
      enabled: z.boolean(),
    })
    .superRefine((value, context) => {
      if (value.kind === "PICKUP" && !value.pickupAddress?.trim())
        context.addIssue({
          code: "custom",
          message: "Indica la dirección de retiro",
          path: ["pickupAddress"],
        });
      if (value.kind === "DELIVERY" && !value.districts.length)
        context.addIssue({
          code: "custom",
          message: "Agrega al menos un ubigeo de cobertura",
          path: ["districts"],
        });
    }),
};

export function validateStoreAdminForm(
  path: string,
  input: unknown,
): { data: Record<string, unknown>; errors: Record<string, string> } {
  const schema = storeAdminSchemas[path as keyof typeof storeAdminSchemas];
  if (!schema)
    return { data: {}, errors: { form: "Formulario no disponible" } };
  const result = schema.safeParse(input);
  if (result.success) return { data: { ...result.data }, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues)
    errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { data: {}, errors };
}

export function validateStoreForm(
  path: string,
  input: unknown,
): { data: Record<string, unknown>; errors: Record<string, string> } {
  const schema = storeFormSchemas[path as keyof typeof storeFormSchemas];
  if (!schema)
    return { data: {}, errors: { form: "Formulario no disponible" } };
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { data: {}, errors };
  }
  const data: Record<string, unknown> = { ...result.data };
  delete data.passwordConfirmation;
  return { data, errors: {} };
}

export const storeFieldRules: Record<
  string,
  {
    minLength?: number;
    maxLength: number;
    autoComplete?: string;
    inputMode?: "numeric" | "tel" | "email";
    hint?: string;
  }
> = {
  firstName: { minLength: 2, maxLength: 100, autoComplete: "given-name" },
  lastName: { minLength: 2, maxLength: 100, autoComplete: "family-name" },
  email: { maxLength: 200, autoComplete: "email", inputMode: "email" },
  password: {
    minLength: 8,
    maxLength: 256,
    hint: "Entre 8 y 256 caracteres. No compartas tu contraseña.",
  },
  passwordConfirmation: { minLength: 8, maxLength: 256 },
  phone: { maxLength: 20, autoComplete: "tel", inputMode: "tel" },
  documentValue: {
    minLength: 8,
    maxLength: 8,
    inputMode: "numeric",
    hint: "DNI de 8 dígitos, sin espacios.",
  },
  district: {
    minLength: 6,
    maxLength: 6,
    inputMode: "numeric",
    hint: "Código ubigeo de 6 dígitos usado para validar la cobertura.",
  },
  street: { minLength: 5, maxLength: 240, autoComplete: "street-address" },
  recipient: { minLength: 2, maxLength: 160, autoComplete: "name" },
  label: { maxLength: 60 },
  reference: { maxLength: 240 },
};
