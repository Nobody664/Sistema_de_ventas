import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateSupplierOrderDto } from "./dto/supplier.dto";

export function supplierOrderLines(input: CreateSupplierOrderDto["items"]) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
    throw new BadRequestException("La orden requiere entre 1 y 100 productos");
  }
  if (new Set(input.map((item) => item.productId)).size !== input.length) {
    throw new BadRequestException(
      "Cada producto debe aparecer una sola vez en la orden",
    );
  }
  const decimal = (
    value: number,
    places: number,
    maximum: string,
    label: string,
  ) => {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new BadRequestException(`${label} inválido`);
    const result = new Prisma.Decimal(value);
    if (
      result.isNegative() ||
      result.decimalPlaces() > places ||
      result.gt(maximum)
    ) {
      throw new BadRequestException(`${label} fuera del rango permitido`);
    }
    return result;
  };
  const items = input.map((item) => {
    const quantity = decimal(
      item.requestedQuantity,
      3,
      "99999999999.999",
      "Cantidad",
    );
    if (quantity.lte(0))
      throw new BadRequestException("La cantidad debe ser positiva");
    const unitCost =
      item.unitCost === undefined
        ? null
        : decimal(item.unitCost, 4, "99999999.9999", "Costo");
    return {
      productId: item.productId,
      suggestedQuantity: quantity,
      requestedQuantity: quantity,
      unitCost,
    };
  });
  const knownTotal = items
    .reduce(
      (total, item) =>
        total.plus(item.requestedQuantity.mul(item.unitCost ?? 0)),
      new Prisma.Decimal(0),
    )
    .toDecimalPlaces(4);
  if (knownTotal.gt("9999999999.9999"))
    throw new BadRequestException(
      "El total estimado excede el rango permitido",
    );
  return {
    items,
    totalEstimated: items.every((item) => item.unitCost !== null)
      ? knownTotal
      : null,
  };
}
