import { Prisma } from "@prisma/client";
import { QueryFinanceRecordDto } from "./dto/finance.dto";

export function financeLedger(
  companyId: string,
  query: QueryFinanceRecordDto,
  range: { from?: Date; to?: Date },
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (range.from) conditions.push(Prisma.sql`"recordDate" >= ${range.from}`);
  if (range.to) conditions.push(Prisma.sql`"recordDate" <= ${range.to}`);
  if (query.direction)
    conditions.push(Prisma.sql`direction = ${query.direction}`);
  if (query.category) conditions.push(Prisma.sql`category = ${query.category}`);
  if (query.currency) conditions.push(Prisma.sql`currency = ${query.currency}`);
  if (query.search?.trim()) {
    const search = `%${query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      Prisma.sql`(description ILIKE ${search} OR reference ILIKE ${search} OR supplier ILIKE ${search})`,
    );
  }
  return Prisma.sql`WITH ledger AS (
    SELECT id, 'MANUAL'::text AS source, direction::text, category::text, description, amount, currency,
      record_date AS "recordDate", due_date AS "dueDate", reference, supplier, notes, employee_id AS "employeeId", created_at AS "createdAt"
    FROM finance_records WHERE company_id = ${companyId}
    UNION ALL
    SELECT id, 'SALE'::text, 'EXIT'::text, 'SALE'::text, 'Venta ' || "saleNumber", total_amount, 'PEN'::text,
      created_at, NULL::timestamp, "saleNumber", NULL::text, NULL::text, NULL::text, created_at
    FROM sales WHERE company_id = ${companyId} AND status = 'COMPLETED'
  ), filtered AS (SELECT * FROM ledger WHERE ${Prisma.join(conditions, " AND ")})`;
}
