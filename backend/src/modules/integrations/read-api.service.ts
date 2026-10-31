import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { IntegrationPageDto } from "./dto/api-key.dto";

@Injectable()
export class ReadApiService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(companyId: string, query: IntegrationPageDto) {
    const rows = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.after ? { id: { gt: query.after } } : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        categoryId: true,
        barcode: true,
        baseUnit: true,
        salePrice: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
      take: 101,
    });
    return {
      version: 1,
      items: rows.slice(0, 100),
      nextCursor: rows.length > 100 ? rows[99].id : null,
    };
  }

  async inventory(companyId: string, query: IntegrationPageDto) {
    const rows = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.after ? { id: { gt: query.after } } : {}),
      },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        minStock: true,
        baseUnit: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
      take: 101,
    });
    return {
      version: 1,
      items: rows.slice(0, 100),
      nextCursor: rows.length > 100 ? rows[99].id : null,
    };
  }

  async sales(companyId: string, query: IntegrationPageDto) {
    const rows = await this.prisma.sale.findMany({
      where: {
        companyId,
        ...(query.after ? { id: { gt: query.after } } : {}),
      },
      select: {
        id: true,
        saleNumber: true,
        status: true,
        channel: true,
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
      take: 101,
    });
    return {
      version: 1,
      items: rows.slice(0, 100),
      nextCursor: rows.length > 100 ? rows[99].id : null,
    };
  }
}
