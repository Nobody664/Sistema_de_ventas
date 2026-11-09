import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StoreAccountStatus } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  StoreAdminAccountsQueryDto,
  StoreAdminCatalogQueryDto,
} from "./dto/store-admin.dto";

@Injectable()
export class StoreAdminManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(companyId: string, query: StoreAdminCatalogQueryDto) {
    const where: Prisma.ProductWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { sku: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.publication
        ? { storeVisible: query.publication === "published" }
        : {}),
      ...(query.activity ? { isActive: query.activity === "active" } : {}),
    };
    const [data, total, categories] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          sku: true,
          imageUrl: true,
          salePrice: true,
          storeVisible: true,
          isActive: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      this.prisma.product.count({ where }),
      this.prisma.category.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    ]);
    return { data, total, page: query.page, limit: query.limit, categories };
  }

  async accounts(companyId: string, query: StoreAdminAccountsQueryDto) {
    const where: Prisma.CustomerAccountWhereInput = {
      companyId,
      ...(query.status ? { status: query.status as StoreAccountStatus } : {}),
      ...(query.q
        ? {
            customer: {
              OR: [
                { firstName: { contains: query.q, mode: "insensitive" } },
                { lastName: { contains: query.q, mode: "insensitive" } },
                { email: { contains: query.q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.customerAccount.findMany({
        where,
        select: {
          id: true,
          status: true,
          createdAt: true,
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: (query.page - 1) * query.limit,
      }),
      this.prisma.customerAccount.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async account(companyId: string, id: string) {
    const account = await this.prisma.customerAccount.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        verifiedAt: true,
        customer: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        _count: { select: { orders: true } },
      },
    });
    if (!account) throw new NotFoundException("Cuenta comercial no encontrada");
    const orders = await this.prisma.storeOrder.findMany({
      where: { companyId, accountId: id },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
    });
    return { ...account, orders };
  }

  async suspendAccount(companyId: string, id: string, suspended: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.customerAccount.updateMany({
        where: {
          id,
          companyId,
          verifiedAt: { not: null },
          status: { not: "CLOSED" },
        },
        data: { status: suspended ? "SUSPENDED" : "ACTIVE" },
      });
      if (suspended && result.count)
        await tx.storeSession.updateMany({
          where: { companyId, accountId: id },
          data: { revokedAt: new Date() },
        });
      return { updated: result.count === 1 };
    });
  }
}
