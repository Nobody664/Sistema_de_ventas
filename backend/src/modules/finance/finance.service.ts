import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, FinanceCategory, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { dateRange, pagination } from "@/common/helpers/query-bounds.helper";
import { financeLedger } from "./finance-query.helper";
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
  currency: string;
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

type LedgerRow = Omit<
  FinanceRecordView,
  "amount" | "recordDate" | "dueDate" | "createdAt" | "editable"
> & {
  amount: Prisma.Decimal;
  recordDate: Date;
  dueDate: Date | null;
  createdAt: Date;
};

const toNumber = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
};

const weekStartOf = (date: Date): Date => {
  const copy = startOfDay(date);
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - diff);
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
    const { page, limit, skip } = pagination(query.page, query.limit);
    const ledger = financeLedger(
      companyId,
      query,
      dateRange(query.from, query.to),
    );
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<LedgerRow[]>(Prisma.sql`${ledger}
        SELECT f.*, CASE WHEN e.id IS NULL THEN NULL ELSE concat_ws(' ', e.first_name, e.last_name) END AS "employeeName"
        FROM filtered f LEFT JOIN employees e ON e.id = f."employeeId" AND e.company_id = ${companyId}
        ORDER BY f."recordDate" DESC, f."createdAt" DESC, f.source ASC, f.id ASC LIMIT ${limit} OFFSET ${skip}`);
        const counts = await tx.$queryRaw<Array<{ total: bigint }>>(
          Prisma.sql`${ledger} SELECT count(*) AS total FROM filtered`,
        );
        return {
          items: rows.map((row) => ({
            ...row,
            amount: Number(row.amount),
            recordDate: row.recordDate.toISOString(),
            dueDate: row.dueDate?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            editable: row.source === "MANUAL",
          })),
          total: Number(counts[0]?.total ?? 0),
          page,
          limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getSummary(
    companyId: string,
    query: QueryFinanceRecordDto,
  ): Promise<FinanceSummary> {
    const range = dateRange(query.from, query.to, 30);
    const currency = query.currency ?? "PEN";
    const ledger = financeLedger(companyId, { ...query, currency }, range);
    const groups = await this.prisma.$queryRaw<
      Array<{
        direction: string;
        category: string;
        amount: Prisma.Decimal;
        count: bigint;
        week: Date;
      }>
    >(Prisma.sql`${ledger}
      SELECT direction, category, sum(amount) AS amount, count(*) AS count, date_trunc('week', "recordDate") AS week
      FROM filtered GROUP BY direction, category, date_trunc('week', "recordDate") ORDER BY week`);

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
        end.setUTCDate(end.getUTCDate() + 6);
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

    for (const row of groups) {
      const amount = toNumber(row.amount);
      const count = Number(row.count);
      const bucket = bucketFor(row.week);
      byCategory[row.category] = (byCategory[row.category] ?? 0) + amount;

      if (row.direction === "ENTRY") {
        entriesTotal += amount;
        entriesCount += count;
        bucket.entries += amount;
      } else {
        exitsTotal += amount;
        exitsCount += count;
        bucket.exits += amount;
        if (row.category === "SALE") {
          salesTotal += amount;
          salesCount += count;
          bucket.sales += amount;
        } else {
          expensesTotal += amount;
          expensesCount += count;
          bucket.expenses += amount;
        }
      }
    }

    const weeksList = [...weeks.values()]
      .map((bucket) => ({ ...bucket, balance: bucket.entries - bucket.exits }))
      .sort((a, b) => a.start.localeCompare(b.start));

    return {
      currency,
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
}
