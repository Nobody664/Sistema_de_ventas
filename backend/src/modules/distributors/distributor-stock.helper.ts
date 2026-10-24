import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export async function requireDistributorStock(
  tx: Prisma.TransactionClient,
  companyId: string,
  distributorId: string,
): Promise<void> {
  const distributor = await tx.distributor.findFirst({
    where: { id: distributorId, companyId, deletedAt: null },
    select: { stockReconciled: true },
  });
  if (!distributor?.stockReconciled)
    throw new ConflictException(
      "El stock por producto del distribuidor requiere conciliación antes de operar",
    );
}

export async function debitDistributorStock(
  tx: Prisma.TransactionClient,
  distributorId: string,
  productId: string,
  quantity: Prisma.Decimal,
): Promise<void> {
  if (!quantity.isFinite() || quantity.lte(0))
    throw new BadRequestException("Cantidad inválida");
  const changed = await tx.distributorStock.updateMany({
    where: { distributorId, productId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (changed.count !== 1)
    throw new BadRequestException(
      `El distribuidor no dispone del producto ${productId} en la cantidad solicitada`,
    );
}

export async function creditDistributorStock(
  tx: Prisma.TransactionClient,
  distributorId: string,
  productId: string,
  quantity: Prisma.Decimal,
): Promise<void> {
  if (!quantity.isFinite() || quantity.lte(0))
    throw new BadRequestException("Cantidad inválida");
  await tx.distributorStock.upsert({
    where: { distributorId_productId: { distributorId, productId } },
    create: { distributorId, productId, quantity },
    update: { quantity: { increment: quantity } },
  });
}
