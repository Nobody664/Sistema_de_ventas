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
    const ordered = [...lines].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    );
    if (!ordered.length)
      throw new BadRequestException("El pedido no contiene productos");
    const ids = ordered.map((line) => line.productId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException("El pedido contiene productos repetidos");
    await tx.$queryRaw`SELECT id FROM products WHERE company_id = ${companyId} AND id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    const products = await tx.product.findMany({
      where: {
        companyId,
        id: { in: ids },
        storeVisible: true,
        isActive: true,
        deletedAt: null,
      },
    });
    await tx.$queryRaw`SELECT id FROM product_batches WHERE company_id = ${companyId} AND product_id IN (${Prisma.join(ids)}) ORDER BY product_id, expiration_date ASC NULLS LAST, id FOR UPDATE`;
    const batches = await tx.productBatch.findMany({
      where: { companyId, productId: { in: ids } },
      orderBy: [
        { expirationDate: { sort: "asc", nulls: "last" } },
        { id: "asc" },
      ],
    });
    const openings: Prisma.ProductBatchCreateManyInput[] = [];
    for (const line of ordered) {
      const product = products.find((item) => item.id === line.productId);
      const quantity = new Prisma.Decimal(line.baseQuantity);
      if (
        !product ||
        quantity.lte(0) ||
        product.stockQuantity.minus(product.reservedQuantity).lt(quantity)
      )
        throw new BadRequestException(
          `Stock insuficiente: ${product?.name ?? line.productId}`,
        );
      const tracked = batches
        .filter((batch) => batch.productId === product.id)
        .reduce(
          (sum, batch) => sum.plus(batch.quantityAvailable),
          new Prisma.Decimal(0),
        );
      const untracked = product.stockQuantity.minus(tracked);
      if (untracked.gt(0))
        openings.push({
          companyId,
          productId: product.id,
          batchNumber: `STORE-OPENING-${ownerId}-${product.id}`,
          quantityReceived: untracked,
          quantityAvailable: untracked,
          purchasePrice: product.costPrice ?? 0,
          expirationDate: product.expiryDate,
        });
    }
    if (openings.length)
      batches.push(
        ...(await tx.productBatch.createManyAndReturn({ data: openings })),
      );
    batches.sort(
      (a, b) =>
        (a.expirationDate?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.expirationDate?.getTime() ?? Number.POSITIVE_INFINITY) ||
        a.id.localeCompare(b.id),
    );
    const reservations = await tx.stockReservation.createManyAndReturn({
      data: ordered.map((line) => ({
        companyId,
        ownerId,
        productId: line.productId,
        quantity: new Prisma.Decimal(line.baseQuantity),
        expiresAt,
      })),
      select: { id: true, productId: true },
    });
    const allocations: Prisma.StockReservationAllocationCreateManyInput[] = [];
    for (const line of ordered) {
      const reservation = reservations.find(
        (item) => item.productId === line.productId,
      )!;
      let remaining = new Prisma.Decimal(line.baseQuantity);
      for (const batch of batches.filter(
        (item) => item.productId === line.productId,
      )) {
        if (remaining.lte(0)) break;
        if (batch.expirationDate && batch.expirationDate < today) continue;
        const take = Prisma.Decimal.min(
          remaining,
          batch.quantityAvailable.minus(batch.reservedQuantity),
        );
        if (take.lte(0)) continue;
        allocations.push({
          companyId,
          productId: line.productId,
          reservationId: reservation.id,
          batchId: batch.id,
          quantity: take,
        });
        remaining = remaining.minus(take);
      }
      if (remaining.gt(0))
        throw new BadRequestException(
          `No hay lotes aptos suficientes: ${products.find((item) => item.id === line.productId)?.name}`,
        );
    }
    const batchValues = allocations.map(
      (item) =>
        Prisma.sql`(${item.batchId}, ${item.quantity.toString()}::numeric)`,
    );
    const batchCount =
      await tx.$executeRaw`UPDATE product_batches AS batch SET reserved_quantity = batch.reserved_quantity + requested.quantity FROM (VALUES ${Prisma.join(batchValues)}) AS requested(id, quantity) WHERE batch.id = requested.id AND batch.company_id = ${companyId}`;
    if (batchCount !== allocations.length)
      throw new BadRequestException("Los lotes cambiaron durante la reserva");
    await tx.stockReservationAllocation.createMany({ data: allocations });
    const productValues = ordered.map(
      (line) => Prisma.sql`(${line.productId}, ${line.baseQuantity}::numeric)`,
    );
    const productCount =
      await tx.$executeRaw`UPDATE products AS product SET reserved_quantity = product.reserved_quantity + requested.quantity FROM (VALUES ${Prisma.join(productValues)}) AS requested(id, quantity) WHERE product.id = requested.id AND product.company_id = ${companyId}`;
    if (productCount !== ordered.length)
      throw new BadRequestException(
        "Los productos cambiaron durante la reserva",
      );
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

  async consume(
    tx: Prisma.TransactionClient,
    companyId: string,
    ownerId: string,
  ): Promise<boolean> {
    const today = await this.today(companyId, tx);
    const holds = await tx.stockReservation.findMany({
      where: { companyId, ownerId },
      include: { allocations: { include: { batch: true } } },
      orderBy: { productId: "asc" },
    });
    if (
      !holds.length ||
      holds.some(
        (hold) =>
          hold.state !== "ACTIVE" ||
          hold.expiresAt <= new Date() ||
          hold.allocations.some(
            (a) => a.batch.expirationDate && a.batch.expirationDate < today,
          ),
      )
    )
      return false;
    for (const hold of holds)
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${hold.productId} FOR UPDATE`;
    for (const hold of holds) {
      const updated = await tx.stockReservation.updateMany({
        where: { id: hold.id, state: "ACTIVE", expiresAt: { gt: new Date() } },
        data: { state: "CONSUMED" },
      });
      if (!updated.count)
        throw new BadRequestException(
          "La reserva cambió durante la confirmación",
        );
      for (const allocation of hold.allocations)
        await tx.productBatch.update({
          where: { id: allocation.batchId },
          data: {
            quantityAvailable: { decrement: allocation.quantity },
            reservedQuantity: { decrement: allocation.quantity },
          },
        });
      await tx.product.update({
        where: { id: hold.productId },
        data: {
          stockQuantity: { decrement: hold.quantity },
          reservedQuantity: { decrement: hold.quantity },
        },
      });
    }
    return true;
  }
}
