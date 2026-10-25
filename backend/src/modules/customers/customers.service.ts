import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  SalesActor,
  salesVisibility,
} from "@/common/helpers/sales-visibility.helper";
import {
  CreateCustomerDto,
  QueryCustomerDto,
  UpdateCustomerDto,
} from "./dto/customer.dto";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { AuditService } from "@/common/services/audit.service";
import { collectExportRows } from "@/common/helpers/export-batch.helper";
import { pagination } from "@/common/helpers/query-bounds.helper";
import {
  buildCsvExport,
  buildPdfExport,
  buildXlsxExport,
  ExportColumn,
} from "@/common/helpers/export.helper";

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
      where: { id, companyId, deletedAt: null },
    });
  }

  async getPurchases(
    companyId: string,
    customerId: string,
    actor: SalesActor,
    query: { page?: number; limit?: number } = {},
  ) {
    const { page, limit, skip } = pagination(query.page, query.limit);
    const where = { ...salesVisibility(companyId, actor), customerId };
    const purchases = await this.prisma.sale.findMany({
      where,
      take: limit,
      skip,
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const [stats, total, lastPurchase] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { ...where, status: "COMPLETED" },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.sale.count({ where }),
      this.prisma.sale.findFirst({
        where: { ...where, status: "COMPLETED" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
      }),
    ]);
    const totalSpent = Number(stats._sum.totalAmount ?? 0);
    const purchaseCount = stats._count.id;
    const averageTicket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

    return {
      purchases,
      page,
      limit,
      total,
      stats: {
        totalSpent,
        purchaseCount,
        lastPurchaseDate: lastPurchase?.createdAt,
        averageTicket,
      },
    };
  }

  findByCompany(companyId: string, query?: QueryCustomerDto) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;
    pagination(page, limit);

    return this.prisma.customer.findMany({
      where: { companyId, deletedAt: null },
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async exportCustomers(
    companyId: string,
    format: "csv" | "excel" | "pdf" = "csv",
  ) {
    const customers = await collectExportRows((take, after) =>
      this.prisma.customer.findMany({
        take,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        where: { companyId, deletedAt: null },
        orderBy: { id: "asc" },
      }),
    );

    const grouped = await this.prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        companyId,
        status: "COMPLETED",
        customerId: { in: customers.map((customer) => customer.id) },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const statsByCustomer = new Map(
      grouped.map((entry) => [
        entry.customerId as string,
        {
          count: entry._count._all,
          total: Number(entry._sum.totalAmount ?? 0),
        },
      ]),
    );

    const rows = customers.map((customer) => ({
      ...customer,
      purchaseCount: statsByCustomer.get(customer.id)?.count ?? 0,
      totalSpent: statsByCustomer.get(customer.id)?.total ?? 0,
    }));

    const columns: ExportColumn<(typeof rows)[number]>[] = [
      { header: "Nombres", value: (c) => c.firstName, width: 2.5 },
      { header: "Apellidos", value: (c) => c.lastName ?? "", width: 2.5 },
      { header: "Documento", value: (c) => c.documentValue ?? "", width: 2 },
      { header: "Email", value: (c) => c.email ?? "", width: 3 },
      { header: "Telefono", value: (c) => c.phone ?? "", width: 1.8 },
      { header: "Compras", value: (c) => c.purchaseCount, width: 1 },
      {
        header: "Total Gastado",
        value: (c) => c.totalSpent,
        pdfValue: (c) => `S/ ${c.totalSpent.toFixed(2)}`,
        width: 1.8,
      },
    ];

    if (format === "csv") {
      return buildCsvExport("clientes", columns, rows);
    }
    if (format === "excel") {
      return buildXlsxExport("clientes", "Clientes", columns, rows);
    }
    return buildPdfExport(
      "clientes",
      "Reporte de Clientes",
      columns,
      rows,
      `Total: ${rows.length} cliente(s)`,
    );
  }

  async create(companyId: string, input: CreateCustomerDto) {
    await this.limitService.validateLimit(companyId, "customers");

    const customer = await this.prisma.customer.create({
      data: {
        companyId,
        ...input,
      },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Customer",
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
      entity: "Customer",
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
        entity: "Customer",
        entityId: id,
        changes: { softDelete: true, salesCount },
      });

      return customer;
    }

    const customer = await this.prisma.customer.delete({ where: { id } });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "Customer",
      entityId: id,
      changes: { softDelete: false, firstName: existing.firstName },
    });

    return customer;
  }

  private async ensureCustomer(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    return customer;
  }
}
