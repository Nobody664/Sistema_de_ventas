import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { ReceiveSupplierOrderDto } from "./dto/supplier.dto";

export function supplierReceipt(
  order: {
    id: string;
    reference: string | null;
    items: readonly { productId: string; requestedQuantity: Prisma.Decimal }[];
  },
  input: ReceiveSupplierOrderDto,
) {
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0 ||
    input.items.length > 100
  )
    throw new BadRequestException("La recepción requiere entre 1 y 100 líneas");
  const expected = new Map(
    order.items.map((item) => [item.productId, item.requestedQuantity]),
  );
  if (expected.size !== order.items.length)
    throw new BadRequestException(
      "La orden contiene productos duplicados y requiere conciliación",
    );
  if (
    input.items.length !== expected.size ||
    new Set(input.items.map((item) => item.productId)).size !== expected.size
  )
    throw new BadRequestException(
      "La recepción debe incluir una vez cada producto de la orden",
    );
  const items = input.items
    .map((item) => {
      if (
        typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) ||
        typeof item.unitCost !== "number" ||
        !Number.isFinite(item.unitCost)
      )
        throw new BadRequestException("Cantidad o costo inválidos");
      const quantity = new Prisma.Decimal(item.quantity);
      const cost = new Prisma.Decimal(item.unitCost);
      if (
        quantity.lte(0) ||
        quantity.decimalPlaces() > 3 ||
        quantity.gt("99999999999.999") ||
        cost.isNegative() ||
        cost.decimalPlaces() > 4 ||
        cost.gt("99999999.9999")
      )
        throw new BadRequestException(
          "Cantidad o costo fuera del rango permitido",
        );
      const requested = expected.get(item.productId);
      if (!requested || !quantity.equals(requested))
        throw new BadRequestException(
          "Esta recepción debe coincidir con las cantidades completas solicitadas",
        );
      return { productId: item.productId, quantity, unitCost: cost };
    })
    .sort((left, right) => left.productId.localeCompare(right.productId));
  const reference = input.reference?.trim() || order.reference || undefined;
  const notes = input.notes?.trim() || `Recepción de orden ${order.id}`;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        orderId: order.id,
        branchId: input.branchId ?? null,
        reference: reference ?? null,
        notes,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity.toString(),
          unitCost: item.unitCost.toString(),
        })),
      }),
    )
    .digest("hex");
  return { items, reference, notes, fingerprint };
}
