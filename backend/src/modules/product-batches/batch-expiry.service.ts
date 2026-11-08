import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { batchExpiryDays, batchExpiryWindow } from "./batch-expiry.policy";
import { BatchExpiryQueryDto, BatchWriteOffDto } from "./dto/batch-expiry.dto";

@Injectable()
export class BatchExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(companyId: string, query: BatchExpiryQueryDto) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { timezone: true, currency: true },
    });
    const window = batchExpiryWindow(company.timezone);
    const base: Prisma.ProductBatchWhereInput = {
      companyId,
      quantityAvailable: { gt: 0 },
      product: { deletedAt: null },
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.search
        ? {
            OR: [
              { batchNumber: { contains: query.search, mode: "insensitive" } },
              {
                product: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
              {
                product: {
                  sku: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const expired: Prisma.ProductBatchWhereInput = {
      ...base,
      expirationDate: { lt: window.start },
    };
    const expiring: Prisma.ProductBatchWhereInput = {
      ...base,
      expirationDate: { gte: window.start, lt: window.end },
    };
    const where =
      query.status === "EXPIRED"
        ? expired
        : query.status === "EXPIRING"
          ? expiring
          : { ...base, expirationDate: { lt: window.end } };
    const [rows, total, expiredCount, expiringCount] = await Promise.all([
      this.prisma.productBatch.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              baseUnit: true,
              isActive: true,
            },
          },
          branch: { select: { name: true } },
        },
        orderBy: [{ expirationDate: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productBatch.count({ where }),
      this.prisma.productBatch.count({ where: expired }),
      this.prisma.productBatch.count({ where: expiring }),
    ]);
    return {
      today: window.today,
      lastDay: window.lastDay,
      timezone: company.timezone,
      currency: company.currency,
      page: query.page,
      total,
      totalPages: Math.ceil(total / query.limit),
      counts: { expired: expiredCount, expiring: expiringCount },
      data: rows.map((batch) => ({
        id: batch.id,
        productId: batch.productId,
        product: batch.product,
        branchName: batch.branch?.name ?? null,
        batchNumber: batch.batchNumber,
        expirationDate: batch.expirationDate!.toISOString().slice(0, 10),
        daysLeft: batchExpiryDays(batch.expirationDate, window.today)!,
        quantityReceived: batch.quantityReceived.toString(),
        quantityAvailable: batch.quantityAvailable.toString(),
        reservedQuantity: batch.reservedQuantity.toString(),
        purchasePrice: batch.purchasePrice.toString(),
        lossAmount: batch.quantityAvailable
          .mul(batch.purchasePrice)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          .toFixed(2),
        updatedAt: batch.updatedAt.toISOString(),
      })),
    };
  }

  async writeOff(
    companyId: string,
    id: string,
    input: BatchWriteOffDto,
    userId: string,
  ) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
      throw new BadRequestException("Identificador de lote inválido");
    const target = await this.prisma.productBatch.findFirst({
      where: { id, companyId },
      select: { productId: true },
    });
    if (!target) throw new NotFoundException("Lote no encontrado");
    return serializableTransaction(
      this.prisma,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${target.productId} AND company_id = ${companyId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM product_batches WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`;
        const batch = await tx.productBatch.findFirst({
          where: { id, companyId, productId: target.productId },
          include: { product: true },
        });
        if (!batch || batch.product.deletedAt)
          throw new NotFoundException("Lote no encontrado");
        const company = await tx.company.findUniqueOrThrow({
          where: { id: companyId },
          select: { timezone: true, currency: true },
        });
        const now = new Date();
        const window = batchExpiryWindow(company.timezone, now);
        const daysLeft = batchExpiryDays(batch.expirationDate, window.today);
        if (daysLeft === null || daysLeft > 3)
          throw new BadRequestException(
            "Solo se permite la baja de lotes vencidos o que vencen en los próximos 3 días",
          );
        const quantity = batch.quantityAvailable;
        if (quantity.lte(0))
          throw new ConflictException(
            "El lote ya no tiene existencias pendientes de baja",
          );
        if (
          !quantity.eq(input.expectedQuantityAvailable) ||
          !batch.purchasePrice.eq(input.expectedPurchasePrice) ||
          batch.updatedAt.getTime() !==
            new Date(input.expectedUpdatedAt).getTime()
        )
          throw new ConflictException(
            "El lote cambió. Actualiza la lista y revisa el importe antes de confirmar",
          );
        if (batch.reservedQuantity.gt(0))
          throw new ConflictException(
            "El lote tiene unidades reservadas. Resuelve esas reservas antes de darlo de baja",
          );
        const remaining = batch.product.stockQuantity.minus(quantity);
        if (remaining.lt(0) || remaining.lt(batch.product.reservedQuantity))
          throw new ConflictException(
            "El saldo del producto no permite esta baja. Revisa existencias y reservas",
          );
        const exactCost = quantity.mul(batch.purchasePrice);
        const ledgerCost = exactCost.toDecimalPlaces(
          4,
          Prisma.Decimal.ROUND_HALF_UP,
        );
        const lossAmount = exactCost.toDecimalPlaces(
          2,
          Prisma.Decimal.ROUND_HALF_UP,
        );
        if (lossAmount.gte("10000000000"))
          throw new BadRequestException(
            "El importe supera el límite de registro financiero",
          );
        let balance = await tx.inventoryKardex.findFirst({
          where: { companyId, productId: batch.productId },
          orderBy: [
            { movementDate: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
        });
        if (!balance) {
          const batches = await tx.productBatch.findMany({
            where: {
              companyId,
              productId: batch.productId,
              quantityAvailable: { gt: 0 },
            },
            select: { quantityAvailable: true, purchasePrice: true },
          });
          const tracked = batches.reduce(
            (sum, item) => sum.plus(item.quantityAvailable),
            new Prisma.Decimal(0),
          );
          const untracked = batch.product.stockQuantity.minus(tracked);
          if (untracked.lt(0))
            throw new ConflictException(
              "Las existencias por lotes no coinciden con el producto. Revisa el inventario",
            );
          const openingCost = batches.reduce(
            (sum, item) =>
              sum.plus(item.quantityAvailable.mul(item.purchasePrice)),
            untracked.mul(batch.product.costPrice ?? 0),
          );
          balance = await tx.inventoryKardex.create({
            data: {
              companyId,
              productId: batch.productId,
              movementDate: new Date(now.getTime() - 1),
              movementType: "IN",
              qtyIn: batch.product.stockQuantity,
              unitCostIn: openingCost.div(batch.product.stockQuantity),
              totalCostIn: openingCost,
              balanceQty: batch.product.stockQuantity,
              balanceUnitCost: openingCost.div(batch.product.stockQuantity),
              balanceTotalCost: openingCost,
            },
          });
        }
        if (
          !balance.balanceQty.eq(batch.product.stockQuantity) ||
          balance.balanceTotalCost.lt(ledgerCost) ||
          (remaining.eq(0) && !balance.balanceTotalCost.eq(ledgerCost))
        )
          throw new ConflictException(
            "El kardex no está conciliado para retirar este lote a su costo de compra. Revisa la valorización antes de continuar",
          );
        const reference = `EXPIRY-BATCH:${batch.id}`;
        const notes = `Lote ${batch.batchNumber} (${batch.id}); vencimiento ${batch.expirationDate!.toISOString().slice(0, 10)}; cantidad ${quantity}; costo base ${batch.purchasePrice}. ${input.reason}`;
        const changed = await tx.productBatch.updateMany({
          where: {
            id,
            companyId,
            productId: batch.productId,
            quantityAvailable: quantity,
            reservedQuantity: 0,
            purchasePrice: batch.purchasePrice,
            updatedAt: batch.updatedAt,
          },
          data: { quantityAvailable: 0 },
        });
        if (changed.count !== 1)
          throw new ConflictException("El lote cambió durante la baja");
        await tx.product.update({
          where: { id: batch.productId, companyId },
          data: { stockQuantity: { decrement: quantity } },
        });
        const movement = await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: batch.productId,
            branchId: batch.branchId,
            type: "LOSS",
            quantity: quantity.neg(),
            unitCost: batch.purchasePrice,
            totalCost: ledgerCost,
            reference,
            reason: "EXPIRED_BATCH_WRITE_OFF",
            notes,
          },
        });
        const balanceCost = balance.balanceTotalCost.minus(ledgerCost);
        await tx.inventoryKardex.create({
          data: {
            companyId,
            productId: batch.productId,
            movementId: movement.id,
            movementDate: now,
            movementType: "OUT",
            qtyOut: quantity,
            unitCostOut: batch.purchasePrice,
            totalCostOut: ledgerCost,
            balanceQty: remaining,
            balanceUnitCost: remaining.gt(0)
              ? balanceCost.div(remaining)
              : new Prisma.Decimal(0),
            balanceTotalCost: balanceCost,
          },
        });
        const finance = await tx.financeRecord.create({
          data: {
            companyId,
            direction: "EXIT",
            category: "EXPIRY_LOSS",
            description: `Pérdida por vencimiento: ${batch.product.name} · lote ${batch.batchNumber}`,
            amount: lossAmount,
            currency: company.currency,
            recordDate: now,
            reference,
            notes: `${notes}. Movimiento ${movement.id}.`,
            createdById: userId,
          },
        });
        await this.audit.log(
          {
            companyId,
            userId,
            action: "UPDATE",
            entity: "ProductBatch",
            entityId: id,
            changes: {
              reason: "EXPIRED_BATCH_WRITE_OFF",
              productId: batch.productId,
              batchNumber: batch.batchNumber,
              quantity: quantity.toString(),
              purchasePrice: batch.purchasePrice.toString(),
              lossAmount: lossAmount.toFixed(2),
              financeRecordId: finance.id,
              movementId: movement.id,
              originalExpirationDate: batch.expirationDate,
              declaredEarly: daysLeft >= 0,
              note: input.reason,
            },
          },
          tx,
        );
        return {
          batchId: id,
          batchNumber: batch.batchNumber,
          productId: batch.productId,
          quantity: quantity.toString(),
          remainingStock: remaining.toString(),
          lossAmount: lossAmount.toFixed(2),
          currency: company.currency,
          financeRecordId: finance.id,
          movementId: movement.id,
        };
      },
      { timeout: 30000 },
    );
  }
}
