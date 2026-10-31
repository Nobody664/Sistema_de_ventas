import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const storeSnapshotSchema = z.object({
  currency: z.literal("PEN"),
  payment: z.object({
    id: z.string(),
    code: z.string(),
    label: z.string(),
    instructions: z.string(),
  }),
  shipping: z.object({
    id: z.string(),
    kind: z.enum(["PICKUP", "DELIVERY"]),
    label: z.string(),
    pickupAddress: z.string().nullable(),
  }),
  address: z
    .object({
      recipient: z.string(),
      phone: z.string(),
      street: z.string(),
      district: z.string(),
      reference: z.string().nullable(),
    })
    .nullable(),
  buyer: z.object({
    firstName: z.string(),
    lastName: z.string(),
    documentValue: z.string(),
    phone: z.string(),
  }),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        presentationId: z.string().nullable(),
        name: z.string(),
        presentationName: z.string().nullable(),
        quantity: z.string(),
        factor: z.string(),
        baseQuantity: z.string(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      }),
    )
    .min(1)
    .max(100),
  subtotal: z.string(),
  taxAmount: z.string(),
  shippingAmount: z.string(),
  totalAmount: z.string(),
});
export type StoreSnapshot = z.infer<typeof storeSnapshotSchema>;

export function storeAmounts(
  lines: { quantity: Prisma.Decimal; price: Prisma.Decimal }[],
  shipping: Prisma.Decimal,
  taxRate: Prisma.Decimal,
  included: boolean,
) {
  const rate = taxRate.div(100);
  const amounts = lines.map((line) => {
    const raw = line.quantity.mul(line.price).toDecimalPlaces(2);
    const net = included ? raw.div(rate.plus(1)).toDecimalPlaces(2) : raw;
    const tax = included ? raw.minus(net) : net.mul(rate).toDecimalPlaces(2);
    return {
      unitPrice: (included ? line.price.div(rate.plus(1)) : line.price)
        .toDecimalPlaces(4)
        .toString(),
      totalPrice: net.toFixed(2),
      tax,
    };
  });
  const subtotal = amounts.reduce(
    (sum, line) => sum.plus(line.totalPrice),
    new Prisma.Decimal(0),
  );
  const shippingNet = included
    ? shipping.div(rate.plus(1)).toDecimalPlaces(2)
    : shipping;
  const shippingTax = included
    ? shipping.minus(shippingNet)
    : shippingNet.mul(rate).toDecimalPlaces(2);
  const taxAmount = amounts.reduce(
    (sum, line) => sum.plus(line.tax),
    shippingTax,
  );
  const totalAmount = subtotal.plus(shippingNet).plus(taxAmount);
  if (!totalAmount.isFinite() || totalAmount.gt("9999999999.99"))
    throw new BadRequestException("El importe excede el límite del pedido");
  return {
    lines: amounts,
    subtotal: subtotal.toFixed(2),
    shippingAmount: shippingNet.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  };
}
