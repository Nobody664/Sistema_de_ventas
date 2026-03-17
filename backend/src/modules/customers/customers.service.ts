import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitService: SubscriptionLimitService,
  ) {}

  async getLimitsInfo(companyId: string) {
    return this.limitService.getAllLimitsInfo(companyId);
  }

  findById(companyId: string, id: string) {
    return this.prisma.customer.findFirst({
      where: { id, companyId },
    });
  }

  async getPurchases(companyId: string, customerId: string) {
    const purchases = await this.prisma.sale.findMany({
      where: { companyId, customerId },
      include: {
        employee: {
          select: { firstName: true, lastName: true },
        },
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalSpent = purchases.reduce((acc, s) => acc + Number(s.totalAmount), 0);
    const purchaseCount = purchases.length;
    const lastPurchase = purchases[0] || null;
    const averageTicket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

    return {
      purchases,
      stats: {
        totalSpent,
        purchaseCount,
        lastPurchaseDate: lastPurchase?.createdAt,
        averageTicket,
      },
    };
  }

  findByCompany(companyId: string) {
    return this.prisma.customer.findMany({
      where: { companyId },
      include: {
        sales: {
          select: { totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async calculateTotalPurchases(companyId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { companyId },
      include: {
        sales: {
          select: { totalAmount: true },
        },
      },
    });

    await Promise.all(
      customers.map(async (customer) => {
        const totalPurchases = customer.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { totalPurchases: totalPurchases.toFixed(2) },
        });
      }),
    );

    return { success: true, updated: customers.length };
  }

  async create(companyId: string, input: CreateCustomerDto) {
    await this.limitService.validateLimit(companyId, 'customers');

    return this.prisma.customer.create({
      data: {
        companyId,
        ...input,
      },
    });
  }

  async update(companyId: string, id: string, input: UpdateCustomerDto) {
    await this.ensureCustomer(companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: input,
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensureCustomer(companyId, id);
    return this.prisma.customer.delete({ where: { id } });
  }

  private async ensureCustomer(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }
}
