import { z } from "zod";

export const createDiscountCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres")
      .max(32, "Máximo 32 caracteres")
      .regex(/^[A-Za-z0-9_-]+$/, "Solo letras, números, guion y guion bajo"),
    description: z
      .string()
      .trim()
      .max(200, "Máximo 200 caracteres")
      .optional()
      .or(z.literal("")),
    type: z.enum(["PERCENTAGE", "FIXED"], {
      required_error: "Selecciona el tipo de descuento",
      invalid_type_error: "Selecciona el tipo de descuento",
    }),
    value: z.coerce
      .number({ invalid_type_error: "Ingresa un valor válido" })
      .positive("Debe ser mayor a 0"),
    maxUses: z.coerce
      .number({ invalid_type_error: "Cupo inválido" })
      .int("Debe ser un número entero")
      .min(1, "Al menos 1 uso")
      .nullable()
      .optional(),
    minPurchase: z.coerce
      .number({ invalid_type_error: "Monto inválido" })
      .min(0, "No puede ser negativo")
      .nullable()
      .optional(),
    startsAt: z.string().optional().or(z.literal("")),
    expiresAt: z.string().optional().or(z.literal("")),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "El porcentaje no puede superar el 100%",
      });
    }

    if (data.startsAt && data.expiresAt && data.expiresAt <= data.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "La fecha de fin debe ser posterior a la de inicio",
      });
    }
  });

export const updateDiscountCouponSchema = createDiscountCouponSchema;

export type CreateDiscountCouponDto = z.infer<
  typeof createDiscountCouponSchema
>;
export type UpdateDiscountCouponDto = z.infer<
  typeof updateDiscountCouponSchema
>;
