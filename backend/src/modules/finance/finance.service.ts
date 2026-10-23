import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, FinanceCategory, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import {
  CreateFinanceRecordDto,
  QueryFinanceRecordDto,
  UpdateFinanceRecordDto,
} from "./dto/finance.dto";

export type FinanceRecordSource = "MANUAL" | "SALE";

export interface FinanceRecordView {
  id: string;
  source: FinanceRecordSource;
  direction: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  recordDate: string;
  dueDate: string | null;
  reference: string | null;
  supplier: string | null;
  notes: string | null;
  employeeId: string | null;
  employeeName: string | null;
  editable: boolean;
  createdAt: string;
}

export interface FinanceWeekBucket {
  start: string;
  end: string;
  entries: number;
  exits: number;
  sales: number;
  expenses: number;
  balance: number;
}

export interface FinanceSummary {
  from: string;
  to: string;
  entries: { total: number; count: number };
  exits: { total: number; count: number };
  sales: { total: number; count: number };
  expenses: { total: number; count: number };
  balance: number;
  byCategory: Record<string, number>;
  weeks: FinanceWeekBucket[];
}

const DEFAULT_CATEGORY_BY_DIRECTION: Record<string, FinanceCategory> = {
  ENTRY: "PURCHASE",
  EXIT: "OTHER",
};

const EXPENSE_CATEGORIES: readonly string[] = [
  "PAYROLL",
  "ELECTRICITY",
  "WATER",
  "MAINTENANCE",
  "OTHER",
];

const MAX_MERGED_ROWS = 500;

const toNumber = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const weekStartOf = (date: Date): Date => {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    companyId: string,
    query: QueryFinanceRecordDto,
  ): Promise<{
    items: FinanceRecordView[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const take = Math.min(skip + limit, MAX_MERGED_ROWS);
    const range = this.resolveRange(query);
    const search = query.search?.trim();

    const includesSales =
      (!query.direction || query.direction === "EXIT") &&
      (!query.category || query.category === "SALE");

    const manualWhere: Prisma.FinanceRecordWhereInput = {
      companyId,
      ...(range.from || range.to
        ? {
            recordDate: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(search
        ? {
            OR: [
              {
                description: { contains: search, mode: "insensitive" as const },
              },
              { reference: { contains: search, mode: "insensitive" as const } },
              { supplier: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const saleWhere: Prisma.SaleWhereInput = {
      companyId,
      status: "COMPLETED",
      ...(range.from || range.to
        ? {
            createdAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
      ...(search
        ? { saleNumber: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [manualRows, saleRows, manualCount, saleCount] = await Promise.all([
      this.prisma.financeRecord.findMany({
        where: manualWhere,
        orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
        take,
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
      includesSales
        ? this.prisma.sale.findMany({
            where: saleWhere,
            orderBy: [{ createdAt: "desc" }],
            take,
            select: {
              id: true,
              saleNumber: true,
              totalAmount: true,
              createdAt: true,
            },
          })
        : Promise.resolve(
            [] as Array<{
              id: string;
              saleNumber: string;
              totalAmount: Prisma.Decimal;
              createdAt: Date;
            }>,
          ),
      this.prisma.financeRecord.count({ where: manualWhere }),
      includesSales
        ? this.prisma.sale.count({ where: saleWhere })
        : Promise.resolve(0),
    ]);

    const manualItems = manualRows.map((row) => this.mapManual(row));
    const saleItems = includesSales
      ? saleRows.map((row) => this.mapSale(row))
      : [];

    const merged = [...manualItems, ...saleItems].sort((a, b) => {
      const byDate = b.recordDate.localeCompare(a.recordDate);
      if (byDate !== 0) return byDate;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return {
      items: merged.slice(skip, skip + limit),
      total: manualCount + saleCount,
      page,
      limit,
    };
  }

  async getSummary(
    companyId: string,
    query: QueryFinanceRecordDto,
  ): Promise<FinanceSummary> {
    const range = this.resolveRange(query, 30);

    const [manualRows, saleRows] = await Promise.all([
      this.prisma.financeRecord.findMany({
        where: {
          companyId,
          recordDate: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        },
        select: {
          direction: true,
          category: true,
          amount: true,
          recordDate: true,
        },
      }),
      this.prisma.sale.findMany({
        where: {
          companyId,
          status: "COMPLETED",
          createdAt: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        },
        select: { id: true, totalAmount: true, createdAt: true },
      }),
    ]);

    const weeks = new Map<string, FinanceWeekBucket>();
    const byCategory: Record<string, number> = {};
    let entriesTotal = 0;
    let entriesCount = 0;
    let exitsTotal = 0;
    let exitsCount = 0;
    let salesTotal = 0;
    let salesCount = 0;
    let expensesTotal = 0;
    let expensesCount = 0;

    const bucketFor = (date: Date): FinanceWeekBucket => {
      const start = weekStartOf(date);
      const key = start.toISOString().slice(0, 10);
      let bucket = weeks.get(key);
      if (!bucket) {
        const end = new Date(start.getTime());
        end.setDate(end.getDate() + 6);
        bucket = {
          start: start.toISOString(),
          end: endOfDay(end).toISOString(),
          entries: 0,
          exits: 0,
          sales: 0,
          expenses: 0,
          balance: 0,
        };
        weeks.set(key, bucket);
      }
      return bucket;
    };

    for (const row of manualRows) {
      const amount = toNumber(row.amount);
      const bucket = bucketFor(row.recordDate);
      byCategory[row.category] = (byCategory[row.category] ?? 0) + amount;

      if (row.direction === "ENTRY") {
        entriesTotal += amount;
        entriesCount += 1;
        bucket.entries += amount;
      } else {
        exitsTotal += amount;
        exitsCount += 1;
        bucket.exits += amount;
        if (row.category === "SALE") {
          salesTotal += amount;
          salesCount += 1;
          bucket.sales += amount;
        } else {
          expensesTotal += amount;
          expensesCount += 1;
          bucket.expenses += amount;
        }
      }
    }

    for (const sale of saleRows) {
      const amount = toNumber(sale.totalAmount);
      const bucket = bucketFor(sale.createdAt);
      byCategory.SALE = (byCategory.SALE ?? 0) + amount;

      exitsTotal += amount;
      exitsCount += 1;
      salesTotal += amount;
      salesCount += 1;
      bucket.exits += amount;
      bucket.sales += amount;
    }

    const weeksList = [...weeks.values()]
      .map((bucket) => ({ ...bucket, balance: bucket.entries - bucket.exits }))
      .sort((a, b) => a.start.localeCompare(b.start));

    return {
      from: (range.from ?? new Date(0)).toISOString(),
      to: (range.to ?? new Date()).toISOString(),
      entries: { total: entriesTotal, count: entriesCount },
      exits: { total: exitsTotal, count: exitsCount },
      sales: { total: salesTotal, count: salesCount },
      expenses: { total: expensesTotal, count: expensesCount },
      balance: entriesTotal - exitsTotal,
      byCategory,
      weeks: weeksList,
    };
  }

  async findOne(companyId: string, id: string): Promise<FinanceRecordView> {
    const row = await this.prisma.financeRecord.findFirst({
      where: { id, companyId },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!row) {
      throw new NotFoundException("Registro financiero no encontrado.");
    }

    return this.mapManual(row);
  }

  async create(
    companyId: string,
    userId: string | undefined,
    input: CreateFinanceRecordDto,
  ) {
    const category = this.resolveCategory(input.direction, input.category);

    if (input.employeeId) {
      await this.ensureEmployee(companyId, input.employeeId);
    }

    const record = await this.prisma.financeRecord.create({
      data: {
        companyId,
        direction: input.direction,
        category,
        description: input.description,
        amount: input.amount,
        recordDate: new Date(input.recordDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        reference: input.reference ?? null,
        supplier: input.supplier ?? null,
        employeeId: input.employeeId ?? null,
        notes: input.notes ?? null,
        createdById: userId ?? null,
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.CREATE,
      entity: "FinanceRecord",
      entityId: record.id,
      changes: {
        direction: record.direction,
        category: record.category,
        amount: Number(record.amount),
        recordDate: record.recordDate,
      },
    });

    return this.mapManual(record);
  }

  async update(
    companyId: string,
    id: string,
    input: UpdateFinanceRecordDto,
  ): Promise<FinanceRecordView> {
    const existing = await this.prisma.financeRecord.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException("Registro financiero no encontrado.");
    }

    if (input.employeeId) {
      await this.ensureEmployee(companyId, input.employeeId);
    }

    const category =
      input.direction || input.category
        ? this.resolveCategory(
            input.direction ?? existing.direction,
            input.category ?? existing.category,
          )
        : undefined;

    const data: Prisma.FinanceRecordUpdateInput = {
      ...(input.direction ? { direction: input.direction } : {}),
      ...(category ? { category } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.recordDate !== undefined
        ? { recordDate: new Date(input.recordDate) }
        : {}),
      ...(input.dueDate !== undefined
        ? input.dueDate
          ? { dueDate: new Date(input.dueDate) }
          : { dueDate: null }
        : {}),
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
      ...(input.supplier !== undefined ? { supplier: input.supplier } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.employeeId !== undefined
        ? input.employeeId
          ? { employee: { connect: { id: input.employeeId } } }
          : { employee: { disconnect: true } }
        : {}),
    };

    const record = await this.prisma.financeRecord.update({
      where: { id },
      data,
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "FinanceRecord",
      entityId: record.id,
      changes: {
        before: {
          amount: Number(existing.amount),
          description: existing.description,
        },
        after: {
          amount: Number(record.amount),
          description: record.description,
        },
      },
    });

    return this.mapManual(record);
  }

  async remove(companyId: string, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.financeRecord.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException("Registro financiero no encontrado.");
    }

    await this.prisma.financeRecord.delete({ where: { id } });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "FinanceRecord",
      entityId: id,
      changes: {
        description: existing.description,
        amount: Number(existing.amount),
      },
    });

    return { id };
  }

  private resolveRange(
    query: QueryFinanceRecordDto,
    defaultDays?: number,
  ): {
    from?: Date;
    to?: Date;
  } {
    let from = query.from ? startOfDay(new Date(query.from)) : undefined;
    let to = query.to ? endOfDay(new Date(query.to)) : undefined;

    if (!from && !to && defaultDays) {
      const start = new Date();
      start.setDate(start.getDate() - defaultDays);
      from = startOfDay(start);
      to = endOfDay(new Date());
    }

    return { from, to };
  }

  private resolveCategory(
    direction: string,
    category?: string,
  ): FinanceCategory {
    if (category === "SALE") {
      throw new BadRequestException(
        "Las ventas se registran automaticamente desde el modulo de Ventas.",
      );
    }

    if (
      category &&
      direction === "ENTRY" &&
      EXPENSE_CATEGORIES.includes(category)
    ) {
      throw new BadRequestException(
        "La categoria seleccionada no aplica para entradas.",
      );
    }

    if (category && direction === "EXIT" && category === "PURCHASE") {
      throw new BadRequestException("Las compras se registran como entradas.");
    }

    return (
      (category as FinanceCategory) ??
      DEFAULT_CATEGORY_BY_DIRECTION[direction] ??
      "OTHER"
    );
  }

  private async ensureEmployee(
    companyId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new BadRequestException("El empleado indicado no existe.");
    }
  }

  private mapManual(row: {
    id: string;
    direction: string;
    category: string;
    description: string;
    amount: unknown;
    currency: string;
    recordDate: Date;
    dueDate: Date | null;
    reference: string | null;
    supplier: string | null;
    notes: string | null;
    employeeId: string | null;
    createdAt: Date;
    employee?: { firstName: string; lastName: string | null } | null;
  }): FinanceRecordView {
    const employeeName = row.employee
      ? `${row.employee.firstName}${row.employee.lastName ? ` ${row.employee.lastName}` : ""}`
      : null;

    return {
      id: row.id,
      source: "MANUAL",
      direction: row.direction,
      category: row.category,
      description: row.description,
      amount: toNumber(row.amount),
      currency: row.currency,
      recordDate: row.recordDate.toISOString(),
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      reference: row.reference,
      supplier: row.supplier,
      notes: row.notes,
      employeeId: row.employeeId,
      employeeName,
      editable: true,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapSale(row: {
    id: string;
    saleNumber: string;
    totalAmount: unknown;
    createdAt: Date;
  }): FinanceRecordView {
    return {
      id: row.id,
      source: "SALE",
      direction: "EXIT",
      category: "SALE",
      description: `Venta ${row.saleNumber}`,
      amount: toNumber(row.totalAmount),
      currency: "PEN",
      recordDate: row.createdAt.toISOString(),
      dueDate: null,
      reference: row.saleNumber,
      supplier: null,
      notes: null,
      employeeId: null,
      employeeName: null,
      editable: false,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
