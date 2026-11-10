import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^<>\u0000-\u001f\u007f]*$/);
const assetId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/)
  .nullable();
export const appearanceSchema = z
  .object({
    schemaVersion: z.literal(1),
    themePreset: z.enum(["petroleo-crema", "terracota-arena", "bosque-marfil"]),
    headline: text(80).min(1),
    heroDescription: text(240),
    logoAssetId: assetId,
    coverAssetId: assetId,
    showDescription: z.boolean(),
    showBusinessPhone: z.boolean(),
  })
  .strict();
export type AppearanceDefinition = z.infer<typeof appearanceSchema>;
export const defaultAppearance: AppearanceDefinition = {
  schemaVersion: 1,
  themePreset: "petroleo-crema",
  headline: "Encuentra tu próximo favorito.",
  heroDescription: "Explora, elige y compra a tu ritmo.",
  logoAssetId: null,
  coverAssetId: null,
  showDescription: true,
  showBusinessPhone: false,
};

const definitions: Record<string, z.ZodType> = {
  ORDERS: z
    .object({
      layout: z.enum(["list", "board"]),
      queue: z
        .enum(["all", "review", "prepare", "preparing", "pickup", "shipping"])
        .optional(),
      status: z
        .enum([
          "PENDING_PAYMENT",
          "CONFIRMED",
          "CANCELLED",
          "EXPIRED",
          "REVIEW_REQUIRED",
          "COMPLETED",
        ])
        .optional(),
      paymentStatus: z
        .enum(["PENDING", "UNDER_REVIEW", "REJECTED", "PAID", "REFUNDED"])
        .optional(),
      shippingKind: z.enum(["PICKUP", "DELIVERY"]).optional(),
    })
    .strict(),
  CATALOG: z
    .object({
      layout: z.enum(["list", "gallery"]),
      publication: z.enum(["published", "hidden"]).optional(),
      activity: z.enum(["active", "inactive"]).optional(),
    })
    .strict(),
  CUSTOMERS: z
    .object({
      layout: z.literal("list"),
      status: z
        .enum(["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "CLOSED"])
        .optional(),
    })
    .strict(),
};
export function studioDefinition(
  resource: string,
  input: unknown,
): Record<string, string> {
  const result = definitions[resource]?.safeParse(input);
  if (!result?.success)
    throw new BadRequestException(
      "La vista contiene filtros o columnas no permitidos",
    );
  return result.data as Record<string, string>;
}
export function parseAppearance(input: unknown): AppearanceDefinition {
  const result = appearanceSchema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      "La apariencia contiene campos o valores no permitidos",
    );
  return result.data;
}
