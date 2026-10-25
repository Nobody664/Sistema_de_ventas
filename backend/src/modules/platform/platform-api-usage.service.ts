import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "@/database/prisma/prisma.service";
import { rejectNullFields } from "@/common/helpers/patch-contract.helper";
import { dateRange, pagination } from "@/common/helpers/query-bounds.helper";
import {
  CreateApiProviderDto,
  BillApiUsageDto,
  CreateApiUsageRecordDto,
  QueryApiUsageDto,
  QueryApiUsageRecordsDto,
  UpdateApiProviderDto,
} from "./dto/platform-api-usage.dto";

function currentPeriod(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

@Injectable()
export class PlatformApiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: QueryApiUsageDto) {
    const { page, limit, skip } = pagination(query.page, query.limit);
    const period = query.period || currentPeriod();
    const search = query.search?.trim();
    const start = this.periodStart(period);
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );

    const companyWhere: Prisma.CompanyWhereInput = search
      ? { name: { contains: search, mode: "insensitive" } }
      : {};
    const [companies, companyCount] = await Promise.all([
      this.prisma.company.findMany({
        where: companyWhere,
        select: { id: true, name: true, email: true, status: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where: companyWhere }),
    ]);
    const companyIds = companies.map((company) => company.id);
    const [usage, records, providers, subscriptions, providerCount] =
      await Promise.all([
        this.prisma.apiUsage.findMany({
          where: { period, companyId: { in: companyIds } },
          orderBy: { count: "desc" },
        }),
        this.prisma.apiUsageRecord.groupBy({
          by: ["companyId", "providerId", "currency"],
          where: {
            occurredAt: { gte: start, lt: end },
            companyId: { in: companyIds },
          },
          _sum: { tokens: true, cost: true },
          _count: { _all: true },
        }),
        this.prisma.apiProvider.findMany({
          orderBy: { name: "asc" },
          take: 100,
        }),
        this.prisma.subscription.findMany({
          where: { companyId: { in: companyIds } },
          select: {
            companyId: true,
            planId: true,
            status: true,
            plan: {
              select: {
                id: true,
                code: true,
                name: true,
                apiEnabled: true,
                apiQuota: true,
              },
            },
          },
        }),
        this.prisma.apiProvider.count(),
      ]);

    const usageByCompany = new Map(
      usage.map((entry) => [entry.companyId, entry]),
    );
    const providerById = new Map(
      providers.map((provider) => [provider.id, provider]),
    );

    const recordsByCompany = new Map<
      string,
      { tokens: number; costs: Record<string, number>; requests: number }
    >();
    const recordsByProvider = new Map<
      string,
      {
        name: string;
        slug: string;
        unit: string;
        tokens: number;
        cost: number;
        currency: string;
      }
    >();

    for (const record of records) {
      const company = recordsByCompany.get(record.companyId) ?? {
        tokens: 0,
        costs: {},
        requests: 0,
      };
      company.tokens += record._sum.tokens ?? 0;
      company.costs[record.currency] =
        (company.costs[record.currency] ?? 0) + Number(record._sum.cost ?? 0);
      company.requests += record._count._all;
      recordsByCompany.set(record.companyId, company);

      if (record.providerId) {
        const provider = providerById.get(record.providerId);
        const providerKey = `${record.providerId}:${record.currency}`;
        const entry = recordsByProvider.get(providerKey) ?? {
          name: provider?.name ?? "Proveedor",
          slug: provider?.slug ?? "proveedor",
          unit: provider?.unit ?? "tokens",
          tokens: 0,
          cost: 0,
          currency: record.currency,
        };
        entry.tokens += record._sum.tokens ?? 0;
        entry.cost += Number(record._sum.cost ?? 0);
        recordsByProvider.set(providerKey, entry);
      }
    }

    const subscriptionByCompany = new Map(
      subscriptions.map((sub) => [sub.companyId, sub]),
    );
    const planById = new Map(
      subscriptions.map((sub) => [sub.planId, sub.plan]),
    );

    const rows = companies.map((company) => {
      const aggregate = usageByCompany.get(company.id);
      const detailed = recordsByCompany.get(company.id);
      const subscription = subscriptionByCompany.get(company.id);
      const plan = subscription ? planById.get(subscription.planId) : undefined;

      const requests = aggregate?.count ?? 0;
      const tokens = aggregate?.tokens ?? detailed?.tokens ?? 0;
      const quota = plan?.apiQuota ?? 0;

      return {
        companyId: company.id,
        companyName: company.name,
        companyEmail: company.email,
        companyStatus: company.status,
        planCode: plan?.code ?? null,
        planName: plan?.name ?? null,
        apiEnabled: plan?.apiEnabled ?? false,
        requests,
        tokens,
        quota,
        usagePercent: quota > 0 ? Math.min(100, (requests / quota) * 100) : 0,
        costsByCurrency: detailed?.costs ?? {},
      };
    });

    const totalRequests = rows.reduce((total, row) => total + row.requests, 0);
    const totalTokens = rows.reduce((total, row) => total + row.tokens, 0);
    const costsByCurrency: Record<string, number> = {};
    rows.forEach((row) =>
      Object.entries(row.costsByCurrency).forEach(([currency, cost]) => {
        costsByCurrency[currency] = (costsByCurrency[currency] ?? 0) + cost;
      }),
    );

    return {
      period,
      page,
      limit,
      total: companyCount,
      totalsScope: "PAGE",
      providerCatalogLimit: 100,
      providerCatalogTruncated: providerCount > providers.length,
      totals: {
        requests: totalRequests,
        tokens: totalTokens,
        costsByCurrency,
        companies: rows.length,
        enabledCompanies: rows.filter((row) => row.apiEnabled).length,
      },
      companies: rows,
      providers: Array.from(recordsByProvider.entries()).map(
        ([providerId, entry]) => ({
          providerId: providerId.slice(0, providerId.lastIndexOf(":")),
          ...entry,
        }),
      ),
      providerCatalog: providers.map((provider) => ({
        ...provider,
        costPerUnit: provider.costPerUnit.toNumber(),
      })),
    };
  }

  async listRecords(query: QueryApiUsageRecordsDto) {
    const { page, limit: pageSize } = pagination(
      query.page,
      query.pageSize ?? 25,
    );
    const range = dateRange(query.from, query.to);
    const where: Prisma.ApiUsageRecordWhereInput = {};

    if (query.companyId) where.companyId = query.companyId;
    if (query.providerId) where.providerId = query.providerId;
    if (query.from || query.to) {
      where.occurredAt = {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.apiUsageRecord.findMany({
        where,
        include: {
          provider: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.apiUsageRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        cost: item.cost.toNumber(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async createRecord(input: CreateApiUsageRecordDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException("Empresa no encontrada");
    }

    let cost = input.cost ?? 0;
    let currency = "USD";
    if (input.providerId) {
      const provider = await this.prisma.apiProvider.findUnique({
        where: { id: input.providerId },
      });
      if (!provider) {
        throw new NotFoundException("Proveedor no encontrado");
      }
      cost =
        input.cost ?? provider.costPerUnit.mul(input.tokens ?? 0).toNumber();
      currency = provider.currency;
    }

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.apiUsageRecord.create({
        data: {
          companyId: input.companyId,
          providerId: input.providerId ?? null,
          tokens: input.tokens ?? 0,
          cost: new Prisma.Decimal(cost),
          currency,
          reference: input.reference?.trim() || null,
          occurredAt: input.occurredAt
            ? new Date(input.occurredAt)
            : new Date(),
        },
        include: { provider: { select: { id: true, name: true, slug: true } } },
      });

      const period = currentPeriod(record.occurredAt);
      await tx.apiUsage.upsert({
        where: { companyId_period: { companyId: record.companyId, period } },
        create: {
          companyId: record.companyId,
          period,
          count: 1,
          tokens: record.tokens,
        },
        update: {
          count: { increment: 1 },
          tokens: { increment: record.tokens },
        },
      });

      return { ...record, cost: record.cost.toNumber() };
    });
  }

  async listProviders() {
    const providers = await this.prisma.apiProvider.findMany({
      orderBy: { name: "asc" },
    });
    return providers.map((provider) => ({
      ...provider,
      costPerUnit: provider.costPerUnit.toNumber(),
    }));
  }

  async billRecords(input: BillApiUsageDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.platformAccount.findUnique({
        where: { id: input.accountId },
      });
      if (!account?.isActive)
        throw new BadRequestException("Selecciona una cuenta activa");
      const records = await tx.apiUsageRecord.findMany({
        where: { id: { in: input.recordIds } },
      });
      if (records.length !== input.recordIds.length)
        throw new NotFoundException("Consumo no encontrado");
      if (records.some((record) => record.billed))
        throw new ConflictException("El consumo ya fue contabilizado");
      if (records.some((record) => record.currency !== account.currency))
        throw new BadRequestException(
          "La moneda del consumo debe coincidir con la cuenta",
        );
      const amount = records.reduce(
        (sum, record) => sum.add(record.cost),
        new Prisma.Decimal(0),
      );
      if (amount.lte(0))
        throw new BadRequestException("El costo debe ser mayor que cero");
      const transaction = await tx.platformTransaction.create({
        data: {
          accountId: account.id,
          type: "EXPENSE",
          category: "API_USAGE",
          description: `Consumo de APIs · ${records.length} registros`,
          amount,
          currency: account.currency,
          createdById: actorId,
        },
      });
      const claimed = await tx.apiUsageRecord.updateMany({
        where: { id: { in: input.recordIds }, billed: false },
        data: { billed: true, transactionId: transaction.id },
      });
      if (claimed.count !== records.length)
        throw new ConflictException(
          "El consumo fue contabilizado por otra solicitud",
        );
      return {
        ...transaction,
        amount: transaction.amount.toNumber(),
        records: claimed.count,
      };
    });
  }

  async createProvider(input: CreateApiProviderDto) {
    rejectNullFields(input, [
      "name",
      "slug",
      "unit",
      "costPerUnit",
      "currency",
      "isActive",
    ]);
    const provider = await this.prisma.apiProvider.create({
      data: {
        slug: input.slug.trim().toLowerCase(),
        name: input.name.trim(),
        unit: input.unit?.trim() || "tokens",
        costPerUnit:
          input.costPerUnit !== undefined
            ? new Prisma.Decimal(input.costPerUnit)
            : undefined,
        currency: input.currency?.toUpperCase() || "USD",
        isActive: input.isActive ?? true,
        notes: input.notes?.trim() || null,
      },
    });
    return { ...provider, costPerUnit: provider.costPerUnit.toNumber() };
  }

  async updateProvider(id: string, input: UpdateApiProviderDto) {
    rejectNullFields(input, [
      "name",
      "unit",
      "costPerUnit",
      "currency",
      "isActive",
    ]);
    const provider = await this.prisma.apiProvider.findUnique({
      where: { id },
    });
    if (!provider) {
      throw new NotFoundException("Proveedor no encontrado");
    }

    if (
      input.currency &&
      input.currency.toUpperCase() !== provider.currency &&
      (await this.prisma.apiUsageRecord.count({ where: { providerId: id } }))
    ) {
      throw new ConflictException(
        "No puedes cambiar la moneda de un proveedor con consumo registrado",
      );
    }

    const updated = await this.prisma.apiProvider.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        unit: input.unit?.trim(),
        costPerUnit:
          input.costPerUnit !== undefined
            ? new Prisma.Decimal(input.costPerUnit)
            : undefined,
        currency: input.currency?.toUpperCase(),
        isActive: input.isActive,
        notes: input.notes?.trim(),
      },
    });
    return { ...updated, costPerUnit: updated.costPerUnit.toNumber() };
  }

  async deleteProvider(id: string) {
    const provider = await this.prisma.apiProvider.findUnique({
      where: { id },
    });
    if (!provider) {
      throw new NotFoundException("Proveedor no encontrado");
    }
    await this.prisma.apiProvider.delete({ where: { id } });
    return { deleted: true };
  }

  private periodStart(period: string): Date {
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period))
      throw new BadRequestException("Período inválido");
    const [year, month] = period.split("-").map(Number);
    return new Date(Date.UTC(year, Math.max(0, (month ?? 1) - 1), 1));
  }
}
