import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  companyDateKey,
  companyTimeZone,
} from "@/common/helpers/company-timezone.helper";

@Injectable()
export class StoreStockService {
  constructor(private readonly prisma: PrismaService) {}
  private async today(companyId: string, tx: Prisma.TransactionClient) {
    const company = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { timezone: true },
    });
    return new Date(
      `${companyDateKey(new Date(), companyTimeZone(company.timezone))}T00:00:00Z`,
    );
  }
  async available(companyId: string, productIds: string[]) {
    const today = await this.today(companyId, this.prisma);
    const [products, all, valid] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: {
          id: true,
          stockQuantity: true,
          reservedQuantity: true,
          expiryDate: true,
        },
      }),
      this.prisma.productBatch.groupBy({
        by: ["productId"],
        where: { companyId, productId: { in: productIds } },
        _sum: { quantityAvailable: true },
      }),
      this.prisma.productBatch.groupBy({
        by: ["productId"],
        where: {
          companyId,
          productId: { in: productIds },
          OR: [{ expirationDate: null }, { expirationDate: { gte: today } }],
        },
        _sum: { quantityAvailable: true, reservedQuantity: true },
      }),
    ]);
    return new Map(
      products.map((p) => {
        const total =
          all.find((row) => row.productId === p.id)?._sum.quantityAvailable ??
          new Prisma.Decimal(0);
        const eligible = valid.find((row) => row.productId === p.id)?._sum;
        const untracked =
          !p.expiryDate || p.expiryDate >= today
            ? Prisma.Decimal.max(0, p.stockQuantity.minus(total))
            : new Prisma.Decimal(0);
        return [
          p.id,
          Prisma.Decimal.max(
            0,
            Prisma.Decimal.min(
              p.stockQuantity.minus(p.reservedQuantity),
              (eligible?.quantityAvailable ?? new Prisma.Decimal(0))
                .minus(eligible?.reservedQuantity ?? 0)
                .plus(untracked),
            ),
          ),
        ];
      }),
    );
  }
  async hold(
    tx: Prisma.TransactionClient,
    companyId: string,
    ownerId: string,
    lines: { productId: string; baseQuantity: string }[],
    expiresAt: Date,
  ) {
    const today = await this.today(companyId, tx);
    for (const line of [...lines].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    )) {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${line.productId} AND company_id = ${companyId} FOR UPDATE`;
      const product = await tx.product.findFirstOrThrow({
        where: {
          companyId,
          id: line.productId,
          storeVisible: true,
          isActive: true,
          deletedAt: null,
        },
      });
      const quantity = new Prisma.Decimal(line.baseQuantity);
      if (
        quantity.lte(0) ||
        product.stockQuantity.minus(product.reservedQuantity).lt(quantity)
      )
        throw new BadRequestException(`Stock insuficiente: ${product.name}`);
      const batches = await tx.productBatch.findMany({
        where: { companyId, productId: product.id },
        orderBy: [
          { expirationDate: { sort: "asc", nulls: "last" } },
          { id: "asc" },
        ],
      });
      const untracked = product.stockQuantity.minus(
        batches.reduce(
          (sum, batch) => sum.plus(batch.quantityAvailable),
          new Prisma.Decimal(0),
        ),
      );
      if (untracked.gt(0))
        batches.push(
          await tx.productBatch.create({
            data: {
              companyId,
              productId: product.id,
              batchNumber: `STORE-OPENING-${ownerId}-${product.id}`,
              quantityReceived: untracked,
              quantityAvailable: untracked,
              purchasePrice: product.costPrice ?? 0,
              expirationDate: product.expiryDate,
            },
          }),
        );
      const reservation = await tx.stockReservation.create({
        data: {
          companyId,
          productId: product.id,
          ownerId,
          quantity,
          expiresAt,
        },
      });
      let remaining = quantity;
      for (const batch of batches) {
        if (remaining.lte(0)) break;
        if (batch.expirationDate && batch.expirationDate < today) continue;
        await tx.$queryRaw`SELECT id FROM product_batches WHERE id = ${batch.id} FOR UPDATE`;
        const current = await tx.productBatch.findUniqueOrThrow({
          where: { id: batch.id },
        });
        const take = Prisma.Decimal.min(
          remaining,
          current.quantityAvailable.minus(current.reservedQuantity),
        );
        if (take.lte(0)) continue;
        await tx.productBatch.update({
          where: { id: batch.id },
          data: { reservedQuantity: { increment: take } },
        });
        await tx.stockReservationAllocation.create({
          data: {
            companyId,
            productId: product.id,
            reservationId: reservation.id,
            batchId: batch.id,
            quantity: take,
          },
        });
        remaining = remaining.minus(take);
      }
      if (remaining.gt(0))
        throw new BadRequestException(
          `No hay lotes aptos suficientes: ${product.name}`,
        );
      await tx.product.update({
        where: { id: product.id },
        data: { reservedQuantity: { increment: quantity } },
      });
    }
  }
  async release(
    tx: Prisma.TransactionClient,
    companyId: string,
    ownerId: string,
    expired = false,
  ) {
    const holds = await tx.stockReservation.findMany({
      where: { companyId, ownerId, state: "ACTIVE" },
      include: { allocations: true },
      orderBy: { productId: "asc" },
    });
    for (const hold of holds) {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${hold.productId} FOR UPDATE`;
      const changed = await tx.stockReservation.updateMany({
        where: { id: hold.id, state: "ACTIVE" },
        data: { state: expired ? "EXPIRED" : "RELEASED" },
      });
      if (!changed.count) continue;
      for (const a of hold.allocations)
        await tx.productBatch.update({
          where: { id: a.batchId },
          data: { reservedQuantity: { decrement: a.quantity } },
        });
      await tx.product.update({
        where: { id: hold.productId },
        data: { reservedQuantity: { decrement: hold.quantity } },
      });
    }
  }
}
