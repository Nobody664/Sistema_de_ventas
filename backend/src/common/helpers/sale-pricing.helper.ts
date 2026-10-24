import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

const MAX_MONEY = new Prisma.Decimal("9999999999.99");
const MAX_UNIT_PRICE = new Prisma.Decimal("99999999.9999");
const MAX_QUANTITY = new Prisma.Decimal("99999999999.999");

interface PricedProduct {
  id: string;
  name: string;
  salePrice: Prisma.Decimal;
  isActive: boolean;
  deletedAt: Date | null;
  presentations: readonly {
    id: string;
    factor: Prisma.Decimal;
    price: Prisma.Decimal | null;
    isActive: boolean;
  }[];
}

export interface SaleLineInput {
  productId: string;
  presentationId?: string;
  quantity: number;
  unitPrice?: number;
}

function decimal(
  value: unknown,
  label: string,
  places: number,
  max: Prisma.Decimal,
): Prisma.Decimal {
  if (!(typeof value === "number" || Prisma.Decimal.isDecimal(value)))
    throw new BadRequestException(`${label} inválido`);
  const result = new Prisma.Decimal(value);
  if (
    !result.isFinite() ||
    result.isNegative() ||
    result.decimalPlaces() > places ||
    result.gt(max)
  )
    throw new BadRequestException(`${label} fuera del rango permitido`);
  return result;
}

export function saleAmounts(
  subtotal: Prisma.Decimal,
  tax?: number,
  discount?: number | Prisma.Decimal,
) {
  const taxAmount =
    tax === undefined
      ? new Prisma.Decimal(0)
      : decimal(tax, "Impuesto", 2, MAX_MONEY);
  const discountAmount =
    discount === undefined
      ? new Prisma.Decimal(0)
      : decimal(discount, "Descuento", 2, MAX_MONEY);
  if (
    !subtotal.isFinite() ||
    subtotal.isNegative() ||
    subtotal.gt(MAX_MONEY) ||
    discountAmount.gt(subtotal)
  )
    throw new BadRequestException(
      "El descuento o el subtotal de la venta no son válidos",
    );
  const totalAmount = subtotal.plus(taxAmount).minus(discountAmount);
  if (totalAmount.isNegative() || totalAmount.gt(MAX_MONEY))
    throw new BadRequestException(
      "El total de la venta está fuera del rango permitido",
    );
  return { taxAmount, discountAmount, totalAmount };
}

export function resolveSaleLines(
  products: readonly PricedProduct[],
  items: readonly SaleLineInput[],
  allowPriceOverride = false,
) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100)
    throw new BadRequestException(
      "La venta debe contener entre 1 y 100 líneas",
    );
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = new Map<
    string,
    {
      productId: string;
      productName: string;
      presentationId?: string;
      quantity: Prisma.Decimal;
      baseQuantity: Prisma.Decimal;
      unitFactor: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }
  >();
  for (const item of items) {
    if ("discountAmount" in item && item.discountAmount !== undefined)
      throw new BadRequestException(
        "Los descuentos por línea no están soportados; utiliza el descuento de la venta",
      );
    const product = byId.get(item.productId);
    if (!product || product.isActive === false || product.deletedAt)
      throw new NotFoundException(`Product ${item.productId} not found.`);
    const presentation = item.presentationId
      ? product.presentations?.find(
          (value) => value.id === item.presentationId && value.isActive,
        )
      : undefined;
    if (item.presentationId && !presentation)
      throw new BadRequestException(
        "La presentación no existe o está inactiva",
      );
    const unitFactor = presentation
      ? new Prisma.Decimal(presentation.factor)
      : new Prisma.Decimal(1);
    if (!unitFactor.isFinite() || unitFactor.lte(0))
      throw new BadRequestException("El factor de la presentación es inválido");
    const quantity = decimal(item.quantity, "Cantidad", 3, MAX_QUANTITY);
    if (quantity.lte(0))
      throw new BadRequestException("La cantidad debe ser positiva");
    const catalogPrice = new Prisma.Decimal(
      presentation?.price ??
        new Prisma.Decimal(product.salePrice).mul(unitFactor),
    ).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const unitPrice = decimal(
      item.unitPrice === undefined ? catalogPrice : item.unitPrice,
      "Precio unitario",
      4,
      MAX_UNIT_PRICE,
    );
    if (!allowPriceOverride && !unitPrice.equals(catalogPrice))
      throw new BadRequestException("El precio debe coincidir con el catálogo");
    const previous = lines.get(item.productId);
    if (
      previous &&
      (previous.presentationId !== presentation?.id ||
        !previous.unitPrice.equals(unitPrice))
    )
      throw new BadRequestException(
        "Utiliza una sola presentación y precio por producto en cada venta",
      );
    const combined = quantity.plus(previous?.quantity ?? 0);
    const baseQuantity = combined
      .mul(unitFactor)
      .toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
    if (
      combined.gt(MAX_QUANTITY) ||
      baseQuantity.lte(0) ||
      baseQuantity.gt(MAX_QUANTITY)
    )
      throw new BadRequestException(
        "La cantidad base no puede representarse en inventario",
      );
    const totalPrice = combined
      .mul(unitPrice)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (totalPrice.gt(MAX_MONEY))
      throw new BadRequestException(
        "El importe de la línea excede el rango permitido",
      );
    lines.set(item.productId, {
      productId: item.productId,
      productName: product.name,
      presentationId: presentation?.id,
      quantity: combined,
      baseQuantity,
      unitFactor,
      unitPrice,
      totalPrice,
    });
  }
  return [...lines.values()];
}
