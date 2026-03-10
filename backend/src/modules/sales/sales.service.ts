import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateSaleDto } from './dto/sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  findRecentSales(companyId: string) {
    return this.prisma.sale.findMany({
      where: { companyId },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async createSale(companyId: string, input: CreateSaleDto) {
    const products = (await this.prisma.product.findMany({
      where: {
        companyId,
        id: { in: input.items.map((item) => item.productId) },
      },
    })) as Array<{ id: string; stockQuantity: number; name: string; salePrice: unknown }>;

    const productMap = new Map<string, (typeof products)[number]>(products.map((product) => [product.id, product]));

    let subtotal = 0;
    const itemsData = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}.`);
      }

      const unitPrice = Number(product.salePrice);
      const discountAmount = Number(item.discountAmount ?? '0');
      const totalAmount = unitPrice * item.quantity - discountAmount;
      subtotal += totalAmount;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      };
    });

    const taxAmount = Number(input.taxAmount ?? '0');
    const discountAmount = Number(input.discountAmount ?? '0');
    const totalAmount = subtotal + taxAmount - discountAmount;
    const saleNumber = `SALE-${Date.now()}`;

    return this.prisma.$transaction(async (tx: Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$extends'>) => {
      const sale = await tx.sale.create({
        data: {
          companyId,
          customerId: input.customerId,
          employeeId: input.employeeId,
          saleNumber,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          paymentMethod: input.paymentMethod,
          paidAt: new Date(),
          items: {
            create: itemsData,
          },
        },
        include: { items: true },
      });

      await Promise.all(
        input.items.map(async (item) => {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              type: 'OUTBOUND',
              quantity: item.quantity * -1,
              reason: `Sale ${sale.saleNumber}`,
              referenceId: sale.id,
            },
          });
        }),
      );

      return sale;
    });
  }
}
