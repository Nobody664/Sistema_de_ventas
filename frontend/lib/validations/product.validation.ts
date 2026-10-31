import { z } from "zod";

const productBaseSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "Máximo 100 caracteres"),
  sku: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  barcode: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
  costPrice: z.coerce
    .number({ error: "Ingrese un número válido" })
    .min(0, "El precio debe ser positivo o cero"),
  salePrice: z.coerce
    .number({ error: "Ingrese un número válido" })
    .min(0, "El precio debe ser positivo o cero"),
  stockQuantity: z.coerce
    .number({ error: "Ingrese un número válido" })
    .min(0, "El stock no puede ser negativo"),
  minStock: z.coerce
    .number({ error: "Ingrese un número válido" })
    .min(0, "El stock mínimo no puede ser negativo"),
  baseUnit: z.enum(["UNIT", "KG", "LT", "MT"]).optional(),
  categoryId: z.string().optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  expiryProfile: z
    .enum(["PERISHABLE", "STANDARD", "LONG_LIFE", "CUSTOM"])
    .optional(),
  expiryWarningDays: z.number().int().min(1).max(3650).optional(),
});

const requireCustomExpiryDays = (
  data: {
    expiryProfile?: "PERISHABLE" | "STANDARD" | "LONG_LIFE" | "CUSTOM";
    expiryWarningDays?: number;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.expiryProfile === "CUSTOM" && data.expiryWarningDays == null) {
    ctx.addIssue({
      code: "custom",
      path: ["expiryWarningDays"],
      message: "Indica entre 1 y 3650 días de aviso",
    });
  }
  if (
    data.expiryProfile &&
    data.expiryProfile !== "CUSTOM" &&
    data.expiryWarningDays != null
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["expiryWarningDays"],
      message: "Los días de aviso solo aplican al perfil personalizado",
    });
  }
};

export const createProductSchema = productBaseSchema.superRefine(
  requireCustomExpiryDays,
);

export const updateProductSchema = productBaseSchema
  .omit({ stockQuantity: true })
  .superRefine(requireCustomExpiryDays);

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
