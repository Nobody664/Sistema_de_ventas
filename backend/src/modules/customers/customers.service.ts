import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { AuditService } from '@/common/services/audit.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitService: SubscriptionLimitService,
    private readonly auditService: AuditService,
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        documentType: true,
        documentValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(companyId: string, input: CreateCustomerDto) {
    await this.limitService.validateLimit(companyId, 'customers');

    const customer = await this.prisma.customer.create({
      data: {
        companyId,
        ...input,
      },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: 'Customer',
      entityId: customer.id,
      changes: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        documentType: customer.documentType,
      },
    });

    return customer;
  }

  async update(companyId: string, id: string, input: UpdateCustomerDto) {
    const existing = await this.ensureCustomer(companyId, id);

    const customer = await this.prisma.customer.update({
      where: { id },
      data: input,
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: 'Customer',
      entityId: customer.id,
      changes: {
        before: {
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          phone: existing.phone,
        },
        after: input,
      },
    });

    return customer;
  }

  async remove(companyId: string, id: string) {
    const existing = await this.ensureCustomer(companyId, id);

    const salesCount = await this.prisma.sale.count({
      where: { customerId: id, companyId },
    });

    if (salesCount > 0) {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await this.auditService.log({
        companyId,
        action: AuditAction.DELETE,
        entity: 'Customer',
        entityId: id,
        changes: { softDelete: true, salesCount },
      });

      return customer;
    }

    const customer = await this.prisma.customer.delete({ where: { id } });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: 'Customer',
      entityId: id,
      changes: { softDelete: false, firstName: existing.firstName },
    });

    return customer;
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
