import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function creditAmounts(
  sale: {
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    discountAmount?: Prisma.Decimal | null;
  },
  rawSubtotal: Prisma.Decimal,
  credited: { total: Prisma.Decimal; tax: Prisma.Decimal },
  fullRefund: boolean,
  isCredit: boolean,
) {
  if (
    !rawSubtotal.isFinite() ||
    rawSubtotal.isNegative() ||
    !sale.totalAmount.isFinite() ||
    sale.totalAmount.isNegative()
  )
    throw new BadRequestException(
      "Importes históricos inválidos; concilia la venta",
    );
  if (isCredit && rawSubtotal.gt(sale.subtotal))
    throw new BadRequestException(
      "La nota no puede superar el subtotal original",
    );
  const remaining = sale.totalAmount.minus(credited.total);
  const ratio = sale.subtotal.gt(0)
    ? rawSubtotal.div(sale.subtotal)
    : new Prisma.Decimal(0);
  const net = sale.subtotal.minus(sale.discountAmount ?? 0);
  let subtotal = net.mul(ratio).toDecimalPlaces(2);
  let taxAmount = sale.taxAmount.mul(ratio).toDecimalPlaces(2);
  if (isCredit)
    taxAmount = Prisma.Decimal.min(
      taxAmount,
      sale.taxAmount.minus(credited.tax),
    );
  if (fullRefund) {
    taxAmount = sale.taxAmount.minus(credited.tax);
    subtotal = remaining.minus(taxAmount);
  }
  const totalAmount = subtotal.plus(taxAmount);
  if (
    subtotal.isNegative() ||
    taxAmount.isNegative() ||
    totalAmount.gt("9999999999.99") ||
    (isCredit && totalAmount.gt(remaining))
  )
    throw new BadRequestException(
      "La nota excede el saldo acreditable de la venta",
    );
  return { subtotal, taxAmount, totalAmount };
}
