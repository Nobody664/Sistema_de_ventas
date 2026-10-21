import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, AuditAction } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { KardexService } from "@/modules/kardex/kardex.service";
import { AuditService } from "@/common/services/audit.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import {
  CreatePurchaseReceiptDto,
  CreateStockEntryDto,
} from "./dto/stock-entry.dto";

@Injectable()
export class StockEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kardexService: KardexService,
    private readonly auditService: AuditService,
    private readonly lowStockService: LowStockService,
  ) {}

  findAll(companyId: string) {
    return this.prisma.stockEntry.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, baseUnit: true },
            },
            presentation: { select: { id: true, name: true, factor: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async findById(companyId: string, id: string) {
    const entry = await this.prisma.stockEntry.findFirst({
      where: { id, companyId },
      include: {
        branch: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
          include: {
            product: {
              select: { id: true, name: true, sku: true, baseUnit: true },
            },
            presentation: { select: { id: true, name: true, factor: true } },
          },
        },
      },
    });
    if (!entry) throw new NotFoundException("Stock entry not found.");
    return entry;
  }

  async create(companyId: string, input: CreateStockEntryDto) {
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.branchId, companyId },
      });
      if (!branch) throw new NotFoundException("Branch not found.");
    }

    if (input.distributorId) {
      const distributor = await this.prisma.distributor.findFirst({
        where: { id: input.distributorId, companyId },
      });
      if (!distributor) throw new NotFoundException("Distributor not found.");
    }

    if (input.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId, companyId, deletedAt: null },
      });
      if (!supplier) throw new NotFoundException("Proveedor no encontrado.");
    }

    const productIds = Array.from(
      new Set(input.items.map((item) => item.productId)),
    );
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      include: { presentations: true },
    });
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    const resolvedItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      const presentation = item.presentationId
        ? product.presentations.find(
            (entry) => entry.id === item.presentationId,
          )
        : undefined;
      if (item.presentationId && !presentation) {
        throw new BadRequestException(
          `Presentation ${item.presentationId} not found.`,
        );
      }

      const factor = presentation
        ? new Prisma.Decimal(presentation.factor)
        : new Prisma.Decimal(1);
      const quantity = new Prisma.Decimal(item.quantity);
      const baseQuantity = quantity.mul(factor);
      const unitCost = new Prisma.Decimal(item.unitCost);
      const totalCost = unitCost.mul(quantity);
      const baseUnitCost = baseQuantity.isZero()
        ? unitCost
        : totalCost.div(baseQuantity);

      return {
        productId: item.productId,
        productName: product.name,
        presentationId: presentation?.id,
        quantity,
        baseQuantity,
        unitCost,
        totalCost,
        baseUnitCost,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      };
    });

    const entryId = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.stockEntry.create({
        data: {
          companyId,
          branchId: input.branchId,
          distributorId: input.distributorId,
          supplierId: input.supplierId,
          reference: input.reference,
          notes: input.notes,
          entryDate: input.entryDate ? new Date(input.entryDate) : undefined,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              presentationId: item.presentationId,
              quantity: item.quantity,
              baseQuantity: item.baseQuantity,
              unitCost: item.unitCost,
              expiryDate: item.expiryDate,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of resolvedItems) {
        const update = await tx.product.updateMany({
          where: { id: item.productId, companyId },
          data: {
            stockQuantity: { increment: item.baseQuantity },
            costPrice: item.baseUnitCost,
          },
        });
        if (update.count === 0) {
          throw new NotFoundException(`Product ${item.productId} not found.`);
        }

        if (item.expiryDate) {
          await tx.product.updateMany({
            where: { id: item.productId, companyId },
            data: { expiryDate: item.expiryDate },
          });
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            companyId,
            productId: item.productId,
            presentationId: item.presentationId,
            type: "IN",
            quantity: item.baseQuantity,
            unitCost: item.baseUnitCost,
            totalCost: item.totalCost,
            notes: `Stock entry ${entry.id}`,
          },
        });

        await this.kardexService.recordInMovement(
          companyId,
          item.productId,
          item.baseQuantity,
          item.baseUnitCost,
          movement.id,
          tx,
        );
      }

      await this.auditService.log({
        companyId,
        action: AuditAction.CREATE,
        entity: "StockEntry",
        entityId: entry.id,
        changes: {
          reference: entry.reference,
          branchId: entry.branchId,
          distributorId: entry.distributorId,
          supplierId: entry.supplierId,
          items: resolvedItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            presentationId: item.presentationId,
            quantity: item.quantity.toString(),
            baseQuantity: item.baseQuantity.toString(),
            unitCost: item.unitCost.toString(),
          })),
        },
      });

      return entry.id;
    });

    for (const item of resolvedItems) {
      if (!item.expiryDate) continue;
      try {
        await this.lowStockService.notifyIfExpiring({
          companyId,
          productId: item.productId,
          productName: item.productName,
          expiryDate: item.expiryDate,
        });
      } catch {}
    }

    return this.findById(companyId, entryId);
  }

  async purchasesByDistributor(companyId: string) {
    const entries = await this.prisma.stockEntry.findMany({
      where: { companyId },
      include: {
        distributor: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        items: { select: { quantity: true, unitCost: true } },
      },
      orderBy: { entryDate: "desc" },
      take: 500,
    });

    type Group = {
      supplier: { id: string; name: string; code: string | null } | null;
      distributor: { id: string; name: string; code: string } | null;
      entryCount: number;
      itemCount: number;
      totalPurchased: number;
      pendingCount: number;
      pendingTotal: number;
      lastEntryDate: Date | null;
      entries: Array<{
        id: string;
        reference: string | null;
        entryDate: Date;
        itemCount: number;
        total: number;
        receiptId: string | null;
      }>;
    };

    const groups = new Map<string, Group>();

    for (const entry of entries) {
      const key = entry.supplier?.id
        ? `supplier:${entry.supplier.id}`
        : entry.distributor?.id
          ? `distributor:${entry.distributor.id}`
          : "general";
      const total = entry.items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
        0,
      );

      const group = groups.get(key) ?? {
        supplier: entry.supplier
          ? {
              id: entry.supplier.id,
              name: entry.supplier.name,
              code: entry.supplier.code,
            }
          : null,
        distributor: entry.distributor
          ? {
              id: entry.distributor.id,
              name: entry.distributor.name,
              code: entry.distributor.code,
            }
          : null,
        entryCount: 0,
        itemCount: 0,
        totalPurchased: 0,
        pendingCount: 0,
        pendingTotal: 0,
        lastEntryDate: null,
        entries: [],
      };

      group.entryCount += 1;
      group.itemCount += entry.items.length;
      group.totalPurchased += total;
      if (!entry.receiptId) {
        group.pendingCount += 1;
        group.pendingTotal += total;
      }
      if (!group.lastEntryDate || entry.entryDate > group.lastEntryDate) {
        group.lastEntryDate = entry.entryDate;
      }
      group.entries.push({
        id: entry.id,
        reference: entry.reference,
        entryDate: entry.entryDate,
        itemCount: entry.items.length,
        total,
        receiptId: entry.receiptId,
      });

      groups.set(key, group);
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.totalPurchased - a.totalPurchased,
    );
  }

  async listReceipts(companyId: string) {
    const receipts = await this.prisma.purchaseReceipt.findMany({
      where: { companyId },
      include: {
        distributor: { select: { id: true, name: true, code: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: 100,
    });

    return receipts.map((receipt) => ({
      ...receipt,
      totalAmount: Number(receipt.totalAmount),
    }));
  }

  async getReceipt(companyId: string, id: string) {
    const receipt = await this.prisma.purchaseReceipt.findFirst({
      where: { id, companyId },
      include: {
        distributor: { select: { id: true, name: true, code: true } },
        entries: {
          include: {
            branch: { select: { id: true, name: true } },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, baseUnit: true },
                },
                presentation: {
                  select: { id: true, name: true, factor: true },
                },
              },
            },
          },
          orderBy: { entryDate: "asc" },
        },
      },
    });

    if (!receipt) throw new NotFoundException("Purchase receipt not found.");

    return { ...receipt, totalAmount: Number(receipt.totalAmount) };
  }

  async createReceipt(
    companyId: string,
    userId: string | null,
    input: CreatePurchaseReceiptDto,
  ) {
    const series = (input.series?.trim() || "BI").toUpperCase();

    if (input.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new NotFoundException("Proveedor no encontrado.");
    }

    if (input.distributorId) {
      const distributor = await this.prisma.distributor.findFirst({
        where: { id: input.distributorId, companyId },
        select: { id: true },
      });
      if (!distributor) throw new NotFoundException("Distributor not found.");
    }

    const entries = await this.prisma.stockEntry.findMany({
      where: {
        companyId,
        receiptId: null,
        ...(input.supplierId
          ? { supplierId: input.supplierId }
          : { distributorId: input.distributorId ?? null }),
      },
      include: { items: { select: { quantity: true, unitCost: true } } },
    });

    if (entries.length === 0) {
      throw new BadRequestException(
        "No hay compras pendientes de boletar para este proveedor.",
      );
    }

    const totalAmount = entries.reduce(
      (sum, entry) =>
        sum +
        entry.items.reduce(
          (inner, item) =>
            inner + Number(item.quantity) * Number(item.unitCost),
          0,
        ),
      0,
    );
    const itemCount = entries.reduce(
      (sum, entry) => sum + entry.items.length,
      0,
    );
    const entryIds = entries.map((entry) => entry.id);

    let receiptId: string | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5 && !receiptId; attempt += 1) {
      try {
        receiptId = await this.prisma.$transaction(async (tx) => {
          const last = await tx.purchaseReceipt.findFirst({
            where: { companyId, series },
            orderBy: { number: "desc" },
            select: { number: true },
          });
          const number = (last?.number ?? 0) + 1;

          const receipt = await tx.purchaseReceipt.create({
            data: {
              companyId,
              distributorId: input.distributorId ?? null,
              series,
              number,
              fullNumber: `${series}-${String(number).padStart(6, "0")}`,
              totalAmount,
              entryCount: entries.length,
              itemCount,
              notes: input.notes,
              createdById: userId,
            },
          });

          await tx.stockEntry.updateMany({
            where: { id: { in: entryIds }, companyId, receiptId: null },
            data: { receiptId: receipt.id },
          });

          return receipt.id;
        });
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
      }
    }

    if (!receiptId) {
      throw lastError instanceof Error
        ? lastError
        : new BadRequestException("No se pudo generar el folio de la boleta.");
    }

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.CREATE,
      entity: "PurchaseReceipt",
      entityId: receiptId,
      changes: {
        distributorId: input.distributorId ?? null,
        series,
        entryIds,
        totalAmount,
        entryCount: entries.length,
        itemCount,
      },
    });

    return this.getReceipt(companyId, receiptId);
  }
}
