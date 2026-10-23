import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PlatformTransactionType,
  Prisma,
  type PlatformAccount,
} from "@prisma/client";

import { PrismaService } from "@/database/prisma/prisma.service";
import {
  CreatePlatformAccountDto,
  CreatePlatformTransactionDto,
  QueryPlatformFinanceSummaryDto,
  QueryPlatformTransactionsDto,
  UpdatePlatformAccountDto,
  UpdatePlatformTransactionDto,
} from "./dto/platform-finance.dto";

const DECIMAL = new Prisma.Decimal(0);

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

@Injectable()
export class PlatformFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: QueryPlatformFinanceSummaryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : startOfMonth(now);
    const to = query.to ? new Date(query.to) : now;
    if (from > to)
      throw new BadRequestException("El rango de fechas es inválido");
    const currency = query.currency ?? "PEN";

    const [accounts, payments, transactions] = await Promise.all([
      this.prisma.platformAccount.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.payment.findMany({
        where: {
          status: "SUCCEEDED",
          currency,
          createdAt: { gte: from, lte: to },
        },
        select: {
          amount: true,
          currency: true,
          createdAt: true,
          subscriptionId: true,
        },
      }),
      this.prisma.platformTransaction.findMany({
        where: { currency, occurredAt: { gte: from, lte: to } },
        select: {
          type: true,
          amount: true,
          currency: true,
          occurredAt: true,
          accountId: true,
          category: true,
        },
      }),
    ]);

    const subscriptionRevenue = payments.reduce(
      (total, payment) => total.add(payment.amount),
      DECIMAL,
    );
    const manualIncome = transactions
      .filter((tx) => tx.type === PlatformTransactionType.INCOME)
      .reduce((total, tx) => total.add(tx.amount), DECIMAL);
    const manualExpense = transactions
      .filter((tx) => tx.type === PlatformTransactionType.EXPENSE)
      .reduce((total, tx) => total.add(tx.amount), DECIMAL);

    const totalIncome = subscriptionRevenue.add(manualIncome);
    const net = totalIncome.sub(manualExpense);

    const accountBalances = await this.buildAccountBalances(accounts);

    const seriesStart = startOfMonth(addMonths(now, -5));
    const [seriesPayments, seriesTransactions] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: "SUCCEEDED",
          currency,
          createdAt: { gte: seriesStart, lte: now },
        },
        select: { amount: true, createdAt: true },
      }),
      this.prisma.platformTransaction.findMany({
        where: { currency, occurredAt: { gte: seriesStart, lte: now } },
        select: { amount: true, type: true, occurredAt: true },
      }),
    ]);

    const seriesMap = new Map<
      string,
      { income: Prisma.Decimal; expense: Prisma.Decimal }
    >();
    for (let i = 0; i < 6; i++) {
      seriesMap.set(monthKey(addMonths(seriesStart, i)), {
        income: DECIMAL,
        expense: DECIMAL,
      });
    }
    for (const payment of seriesPayments) {
      const key = monthKey(payment.createdAt);
      const entry = seriesMap.get(key);
      if (entry) entry.income = entry.income.add(payment.amount);
    }
    for (const tx of seriesTransactions) {
      const key = monthKey(tx.occurredAt);
      const entry = seriesMap.get(key);
      if (!entry) continue;
      if (tx.type === PlatformTransactionType.INCOME) {
        entry.income = entry.income.add(tx.amount);
      } else {
        entry.expense = entry.expense.add(tx.amount);
      }
    }

    const monthly = Array.from(seriesMap.entries()).map(([month, entry]) => ({
      month,
      income: entry.income.toNumber(),
      expense: entry.expense.toNumber(),
      net: entry.income.sub(entry.expense).toNumber(),
    }));

    const categoryMap = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== PlatformTransactionType.EXPENSE) continue;
      const current = categoryMap.get(tx.category) ?? 0;
      categoryMap.set(tx.category, current + tx.amount.toNumber());
    }
    const expensesByCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      range: { from, to },
      currency,
      totals: {
        subscriptionRevenue: subscriptionRevenue.toNumber(),
        manualIncome: manualIncome.toNumber(),
        totalIncome: totalIncome.toNumber(),
        totalExpense: manualExpense.toNumber(),
        net: net.toNumber(),
        transactions: transactions.length,
        payments: payments.length,
      },
      accounts: accountBalances,
      monthly,
      expensesByCategory,
    };
  }

  async getTopCompanies(limit = 5) {
    const now = new Date();
    const monthStart = startOfMonth(now);

    const grouped = await this.prisma.payment.groupBy({
      by: ["subscriptionId"],
      where: {
        status: "SUCCEEDED",
        currency: "PEN",
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: limit,
    });

    const subscriptionIds = grouped
      .map((entry) => entry.subscriptionId)
      .filter((id): id is string => Boolean(id));

    if (subscriptionIds.length === 0) return [];

    const subscriptions = await this.prisma.subscription.findMany({
      where: { id: { in: subscriptionIds } },
      include: {
        company: { select: { id: true, name: true } },
        plan: { select: { name: true, code: true } },
      },
    });
    const byId = new Map(subscriptions.map((sub) => [sub.id, sub]));

    return grouped
      .map((entry) => {
        const subscription = entry.subscriptionId
          ? byId.get(entry.subscriptionId)
          : undefined;
        return {
          companyId: subscription?.company.id ?? null,
          companyName: subscription?.company.name ?? "Sin empresa",
          planName: subscription?.plan.name ?? null,
          planCode: subscription?.plan.code ?? null,
          total: entry._sum.amount?.toNumber() ?? 0,
        };
      })
      .filter((entry) => entry.companyId);
  }

  async getCompaniesRevenue(search?: string) {
    const now = new Date();
    const monthStart = startOfMonth(now);

    const companies = await this.prisma.company.findMany({
      where: search
        ? {
            name: { contains: search, mode: "insensitive" },
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        subscriptions: {
          take: 1,
          select: {
            plan: { select: { name: true, code: true } },
            status: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const payments = await this.prisma.payment.findMany({
      where: {
        status: "SUCCEEDED",
        currency: "PEN",
        createdAt: { gte: monthStart },
      },
      select: {
        amount: true,
        subscription: { select: { companyId: true } },
      },
    });

    const revenueByCompany = new Map<string, number>();
    for (const payment of payments) {
      const companyId = payment.subscription?.companyId;
      if (!companyId) continue;
      revenueByCompany.set(
        companyId,
        (revenueByCompany.get(companyId) ?? 0) + payment.amount.toNumber(),
      );
    }

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      email: company.email,
      status: company.status,
      planName: company.subscriptions[0]?.plan.name ?? null,
      planCode: company.subscriptions[0]?.plan.code ?? null,
      subscriptionStatus: company.subscriptions[0]?.status ?? null,
      subscriptionEndDate: company.subscriptions[0]?.endDate ?? null,
      monthRevenue: revenueByCompany.get(company.id) ?? 0,
    }));
  }

  async listTransactions(query: QueryPlatformTransactionsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.PlatformTransactionWhereInput = {};

    if (query.type) where.type = query.type;
    if (query.accountId) where.accountId = query.accountId;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: "insensitive" } },
        { category: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.from || query.to) {
      where.occurredAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.platformTransaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, type: true } },
        },
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.platformTransaction.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        amount: item.amount.toNumber(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async createTransaction(
    input: CreatePlatformTransactionDto,
    createdById: string,
  ) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id: input.accountId },
    });
    if (!account) {
      throw new NotFoundException("Cuenta no encontrada");
    }
    if (!account.isActive)
      throw new BadRequestException("La cuenta está inactiva");
    if (input.currency && input.currency.toUpperCase() !== account.currency) {
      throw new BadRequestException("La moneda debe coincidir con la cuenta");
    }

    if (input.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { id: true },
      });
      if (!company) {
        throw new NotFoundException("Empresa no encontrada");
      }
    }

    const transaction = await this.prisma.platformTransaction.create({
      data: {
        accountId: input.accountId,
        type: input.type,
        category: input.category?.trim() || "GENERAL",
        description: input.description.trim(),
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency?.toUpperCase() || account.currency,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        companyId: input.companyId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        paymentId: input.paymentId ?? null,
        createdById,
      },
      include: { account: { select: { id: true, name: true, type: true } } },
    });

    return { ...transaction, amount: transaction.amount.toNumber() };
  }

  async updateTransaction(id: string, input: UpdatePlatformTransactionDto) {
    const existing = await this.prisma.platformTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Movimiento no encontrado");
    }
    if (
      await this.prisma.apiUsageRecord.count({ where: { transactionId: id } })
    )
      throw new ConflictException(
        "El movimiento está vinculado a consumo de APIs y no se puede editar",
      );

    const account = await this.prisma.platformAccount.findUnique({
      where: { id: input.accountId ?? existing.accountId },
    });
    if (!account) throw new NotFoundException("Cuenta no encontrada");
    if (!account.isActive)
      throw new BadRequestException("La cuenta está inactiva");
    if (
      (input.currency?.toUpperCase() ?? existing.currency) !== account.currency
    ) {
      throw new BadRequestException("La moneda debe coincidir con la cuenta");
    }
    if (
      input.companyId &&
      !(await this.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException("Empresa no encontrada");
    }

    const transaction = await this.prisma.platformTransaction.update({
      where: { id },
      data: {
        accountId: input.accountId,
        type: input.type,
        category: input.category,
        description: input.description?.trim(),
        amount:
          input.amount !== undefined
            ? new Prisma.Decimal(input.amount)
            : undefined,
        currency: input.currency?.toUpperCase(),
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        companyId: input.companyId,
      },
      include: { account: { select: { id: true, name: true, type: true } } },
    });

    return { ...transaction, amount: transaction.amount.toNumber() };
  }

  async deleteTransaction(id: string) {
    const existing = await this.prisma.platformTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Movimiento no encontrado");
    }
    if (
      await this.prisma.apiUsageRecord.count({ where: { transactionId: id } })
    )
      throw new ConflictException(
        "El movimiento está vinculado a consumo de APIs y no se puede eliminar",
      );
    await this.prisma.platformTransaction.delete({ where: { id } });
    return { deleted: true };
  }

  async listAccounts() {
    const accounts = await this.prisma.platformAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
    return this.buildAccountBalances(accounts);
  }

  private async buildAccountBalances(accounts: PlatformAccount[]) {
    const grouped = await this.prisma.platformTransaction.groupBy({
      by: ["accountId", "type"],
      _sum: { amount: true },
    });

    return accounts.map((account) => {
      const income = grouped.find(
        (entry) =>
          entry.accountId === account.id &&
          entry.type === PlatformTransactionType.INCOME,
      );
      const expense = grouped.find(
        (entry) =>
          entry.accountId === account.id &&
          entry.type === PlatformTransactionType.EXPENSE,
      );
      const incomeTotal = income?._sum.amount ?? DECIMAL;
      const expenseTotal = expense?._sum.amount ?? DECIMAL;
      const balance = account.initialBalance.add(incomeTotal).sub(expenseTotal);

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        initialBalance: account.initialBalance.toNumber(),
        isActive: account.isActive,
        notes: account.notes,
        income: incomeTotal.toNumber(),
        expense: expenseTotal.toNumber(),
        balance: balance.toNumber(),
      };
    });
  }

  async createAccount(input: CreatePlatformAccountDto) {
    return this.prisma.platformAccount.create({
      data: {
        name: input.name.trim(),
        type: input.type,
        currency: input.currency?.toUpperCase() || "PEN",
        initialBalance:
          input.initialBalance !== undefined
            ? new Prisma.Decimal(input.initialBalance)
            : undefined,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateAccount(id: string, input: UpdatePlatformAccountDto) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException("Cuenta no encontrada");
    }

    if (input.currency && input.currency.toUpperCase() !== account.currency) {
      const count = await this.prisma.platformTransaction.count({
        where: { accountId: id },
      });
      if (count > 0)
        throw new ConflictException(
          "No puedes cambiar la moneda de una cuenta con movimientos",
        );
    }

    return this.prisma.platformAccount.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        type: input.type,
        currency: input.currency?.toUpperCase(),
        initialBalance:
          input.initialBalance !== undefined
            ? new Prisma.Decimal(input.initialBalance)
            : undefined,
        notes: input.notes?.trim(),
        isActive: input.isActive,
      },
    });
  }

  async deleteAccount(id: string) {
    const account = await this.prisma.platformAccount.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } },
    });
    if (!account) {
      throw new NotFoundException("Cuenta no encontrada");
    }
    if (account._count.transactions > 0) {
      throw new ConflictException(
        "No puedes eliminar una cuenta con movimientos registrados",
      );
    }
    await this.prisma.platformAccount.delete({ where: { id } });
    return { deleted: true };
  }
}
