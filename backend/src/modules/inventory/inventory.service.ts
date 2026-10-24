import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { ProductBatchesService } from "@/modules/product-batches/product-batches.service";
import { AuditService } from "@/common/services/audit.service";
import { KardexService } from "@/modules/kardex/kardex.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import {
  buildCsvExport,
  buildPdfExport,
  buildXlsxExport,
  ExportColumn,
} from "@/common/helpers/export.helper";
import { CreateInventoryAdjustmentDto } from "./dto/inventory.dto";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly kardexService: KardexService,
    private readonly lowStockService: LowStockService,
    private readonly batches: ProductBatchesService,
  ) {}

  async findLowStock(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      orderBy: { stockQuantity: "asc" },
      take: 10000,
    });

    return products
      .filter((product) => product.stockQuantity.lte(product.minStock))
      .slice(0, 50);
  }

  findMovements(companyId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { companyId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async exportInventory(
    companyId: string,
    format: "csv" | "excel" | "pdf" = "csv",
  ) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    const rows = products.map((product) => {
      const stock = Number(product.stockQuantity);
      const cost = Number(product.costPrice ?? 0);
      return {
        name: product.name,
        sku: product.sku,
        category: product.category?.name ?? "",
        baseUnit: product.baseUnit,
        stockQuantity: stock,
        minStock: Number(product.minStock),
        costPrice: cost,
        stockValue: stock * cost,
        isLowStock: stock <= Number(product.minStock),
      };
    });

    const columns: ExportColumn<(typeof rows)[number]>[] = [
      { header: "Producto", value: (r) => r.name, width: 3 },
      { header: "SKU", value: (r) => r.sku ?? "", width: 1.8 },
      { header: "Categoria", value: (r) => r.category, width: 2 },
      { header: "Unidad", value: (r) => r.baseUnit, width: 1.2 },
      { header: "Stock", value: (r) => r.stockQuantity, width: 1 },
      { header: "Stock Minimo", value: (r) => r.minStock, width: 1.4 },
      {
        header: "Costo Unitario",
        value: (r) => r.costPrice,
        pdfValue: (r) => `S/ ${r.costPrice.toFixed(2)}`,
        width: 1.6,
      },
      {
        header: "Valor Stock",
        value: (r) => r.stockValue,
        pdfValue: (r) => `S/ ${r.stockValue.toFixed(2)}`,
        width: 1.6,
      },
      {
        header: "Bajo Stock",
        value: (r) => (r.isLowStock ? "SI" : "NO"),
        width: 1.2,
      },
    ];

    if (format === "csv") {
      return buildCsvExport("inventario", columns, rows);
    }
    if (format === "excel") {
      return buildXlsxExport("inventario", "Inventario", columns, rows);
    }
    const totalValue = rows.reduce((sum, row) => sum + row.stockValue, 0);
    return buildPdfExport(
      "inventario",
      "Reporte de Inventario",
      columns,
      rows,
      `Total: ${rows.length} producto(s) · Valor de stock: S/ ${totalValue.toFixed(2)}`,
    );
  }

  async adjustStock(companyId: string, input: CreateInventoryAdjustmentDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, companyId },
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.isZero()) {
      throw new BadRequestException("La cantidad debe ser distinta de cero.");
    }

    if (input.type !== "ADJUSTMENT" && quantity.lt(0)) {
      throw new BadRequestException(
        "La cantidad debe ser positiva para este tipo de movimiento.",
      );
    }

    let delta: Prisma.Decimal;
    if (input.type === "IN") {
      delta = quantity;
    } else if (input.type === "OUT" || input.type === "LOSS") {
      delta = quantity.neg();
    } else {
      delta = quantity;
    }

    const newStock = product.stockQuantity.plus(delta);
    if (newStock.lt(0)) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${Number(product.stockQuantity)}, ajuste: ${delta.toString()}.`,
      );
    }

    const unitCost = new Prisma.Decimal(
      input.unitCost ?? Number(product.costPrice ?? 0),
    );

    const result = await serializableTransaction(this.prisma, async (tx) => {
      if (
        input.presentationId &&
        !(await tx.productPresentation.findFirst({
          where: {
            id: input.presentationId,
            productId: input.productId,
            companyId,
          },
          select: { id: true },
        }))
      )
        throw new NotFoundException("Presentación no encontrada");
      const productUpdate = await tx.product.updateMany({
        where: {
          id: input.productId,
          companyId,
          ...(delta.lt(0) ? { stockQuantity: { gte: delta.abs() } } : {}),
        },
        data: { stockQuantity: { increment: delta } },
      });
      if (productUpdate.count === 0) {
        throw new BadRequestException(
          "Producto no disponible o stock insuficiente para completar el ajuste.",
        );
      }

      const updatedProduct = await tx.product.findUnique({
        where: { id: input.productId },
      });
      if (!updatedProduct) {
        throw new NotFoundException("Product not found.");
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: input.productId,
          presentationId: input.presentationId,
          type: input.type,
          quantity: delta,
          unitCost: input.type === "IN" ? unitCost : undefined,
          totalCost: input.type === "IN" ? unitCost.mul(delta) : undefined,
          reason: input.reason ?? "Manual adjustment",
        },
      });

      if (delta.gt(0)) {
        await tx.productBatch.create({
          data: {
            companyId,
            productId: input.productId,
            batchNumber: `ADJUST-${movement.id}`,
            quantityReceived: delta,
            quantityAvailable: delta,
            purchasePrice: unitCost,
            expirationDate: product.expiryDate,
          },
        });
        await this.kardexService.recordInMovement(
          companyId,
          input.productId,
          delta,
          unitCost,
          movement.id,
          tx,
        );
      } else {
        await this.batches.reserveFromBatch(
          companyId,
          input.productId,
          delta.abs(),
          tx,
        );
        await this.kardexService.recordOutMovement(
          companyId,
          input.productId,
          delta.abs(),
          movement.id,
          tx,
        );
      }

      return { updatedProduct, movement };
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "InventoryMovement",
      entityId: result.movement.id,
      changes: {
        productId: input.productId,
        productName: product.name,
        type: input.type,
        quantity: input.quantity,
        reason: result.movement.reason,
        stockBefore: Number(product.stockQuantity),
        stockAfter: Number(result.updatedProduct.stockQuantity),
      },
    });

    if (delta.lt(0)) {
      await this.lowStockService.notifyIfLowStock({
        companyId,
        productId: product.id,
        productName: product.name,
        currentStock: result.updatedProduct.stockQuantity,
        minStock: product.minStock,
        baseUnit: product.baseUnit,
        previousStock: product.stockQuantity,
      });
    }

    return result;
  }
}
