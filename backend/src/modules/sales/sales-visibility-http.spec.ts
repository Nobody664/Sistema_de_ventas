import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CacheService } from "@/cache/cache.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import { CustomersController } from "@/modules/customers/customers.controller";
import { CustomersService } from "@/modules/customers/customers.service";
import { DashboardController } from "@/modules/dashboard/dashboard.controller";
import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { InvoicesController } from "@/modules/invoices/invoices.controller";
import { InvoicesService } from "@/modules/invoices/invoices.service";
import { ReportsController } from "@/modules/reports/reports.controller";
import { ReportsService } from "@/modules/reports/reports.service";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

const secret = "sales-boundary-test-secret";
const jwt = new JwtService({ secret });
const actors = { "cashier-a": { companyId: "company-a", role: "CASHIER" }, "cashier-b": { companyId: "company-a", role: "CASHIER" }, admin: { companyId: "company-a", role: "COMPANY_ADMIN" }, outsider: { companyId: "company-b", role: "CASHIER" } };
type ActorId = keyof typeof actors;
const sale = (id: string, sellerId: ActorId, amount: number) => ({ id, sellerId, companyId: actors[sellerId].companyId, customerId: "customer", saleNumber: id, status: "COMPLETED", channel: "POS", paymentMethod: "CASH", createdAt: new Date(), totalAmount: new Prisma.Decimal(amount), subtotal: new Prisma.Decimal(amount), taxAmount: new Prisma.Decimal(0), discountAmount: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(amount), changeAmount: new Prisma.Decimal(0), items: [], customer: { firstName: "Customer", lastName: null }, employee: null, company: { name: "Company" } });
const rows = [sale("sale-a", "cashier-a", 10), sale("sale-b", "cashier-b", 20), sale("sale-c", "outsider", 30)];

describe("Sales visibility across HTTP read paths and caches", () => {
  let app: INestApplication;
  let url: string;
  before(async () => {
    const matching = (where: Prisma.SaleWhereInput) => rows.filter((row) => {
      const date = where.createdAt as { gte?: Date; lte?: Date } | undefined;
      return row.companyId === where.companyId && (!where.sellerId || row.sellerId === where.sellerId) && (!where.id || row.id === where.id) && (!date?.gte || row.createdAt >= date.gte) && (!date?.lte || row.createdAt <= date.lte);
    });
    const fake = {
      user: { findUnique: async ({ where }: { where: { id: ActorId } }) => ({ id: where.id, email: "user@example.invalid", fullName: where.id, globalRole: "USER", isActive: true, authVersion: 0, employee: null, refreshTokens: [{ id: "session" }], memberships: [{ role: actors[where.id].role, company: { id: actors[where.id].companyId, status: "ACTIVE", trialEndsAt: null, subscriptions: [] } }] }) },
      sale: { findMany: async ({ where }: { where: Prisma.SaleWhereInput }) => matching(where), findFirst: async ({ where }: { where: Prisma.SaleWhereInput }) => matching(where)[0] ?? null,
        count: async ({ where }: { where: Prisma.SaleWhereInput }) => matching(where).length,
        aggregate: async ({ where }: { where: Prisma.SaleWhereInput }) => ({ _sum: { totalAmount: new Prisma.Decimal(matching(where).reduce((sum, row) => sum + row.totalAmount.toNumber(), 0)) } }),
        groupBy: async () => [], },
      saleItem: { groupBy: async () => [] },
      product: { count: async () => 0, findMany: async () => [] }, customer: { count: async () => 0 }, employee: { count: async () => 0 },
      company: { findUnique: async () => ({ name: "Company", status: "ACTIVE", currency: "PEN" }) }, invoiceTemplate: { findFirst: async () => null },
    };
    const prisma = fake as unknown as PrismaService;
    const memory = new Map<string, unknown>();
    const cache = { get: async (key: string) => memory.get(key) ?? null, set: async (key: string, data: unknown) => { memory.set(key, data); } } as unknown as CacheService;
    const sales = new SalesService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const module = await Test.createTestingModule({ imports: [PassportModule.register({ defaultStrategy: "jwt" })],
      controllers: [SalesController, CustomersController, InvoicesController, DashboardController, ReportsController],
      providers: [JwtStrategy, { provide: ConfigService, useValue: { getOrThrow: () => secret } }, { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionLimitService, useValue: {} },
        { provide: SalesService, useValue: sales }, { provide: CustomersService, useValue: new CustomersService(prisma, {} as never, {} as never) },
        { provide: InvoicesService, useValue: new InvoicesService(prisma) }, { provide: DashboardService, useValue: new DashboardService(prisma, cache) },
        { provide: ReportsService, useValue: new ReportsService(prisma, cache) }, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: RolesGuard }],
    }).compile();
    app = module.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, "127.0.0.1"); url = await app.getUrl();
  });
  after(async () => { await app?.close(); });

  const get = (path: string, actor: ActorId) => fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${jwt.sign({ sub: actor, roles: [actors[actor].role], companyId: actors[actor].companyId, sid: "family", authVersion: 0 }, { expiresIn: "15m" })}` } });

  it("allows a cashier's own sale and rejects other sellers' and other tenants' detail/boleta URLs", async () => {
    assert.equal((await get("/sales/sale-a", "cashier-a")).status, 200);
    assert.equal((await get("/sales/sale-b", "cashier-a")).status, 404);
    assert.equal((await get("/invoices/generate/sale-b", "cashier-a")).status, 404);
    assert.equal((await get("/invoices/generate/sale-a", "cashier-a")).status, 200);
    assert.equal((await get("/invoices/generate/sale-a", "outsider")).status, 404);
    assert.equal((await get("/sales/sale-c", "admin")).status, 404);
  });

  it("restricts lists and customer purchases to the current cashier while preserving company-admin access", async () => {
    for (const [actor, expected] of [["cashier-a", ["sale-a"]], ["cashier-b", ["sale-b"]], ["admin", ["sale-a", "sale-b"]]] as const) {
      const listing = await get("/sales", actor); assert.equal(listing.status, 200);
      const data = await listing.json() as { id: string }[];
      assert.deepEqual(data.map((row) => row.id).sort(), [...expected]);
      const purchases = await get("/customers/customer/purchases", actor); assert.equal(purchases.status, 200);
      const history = await purchases.json() as { purchases: { id: string }[] };
      assert.deepEqual(history.purchases.map((row) => row.id).sort(), [...expected]);
    }
  });

  it("does not reuse one cashier's dashboard/report cache for another cashier or an administrator", async () => {
    for (const [actor, revenue, count] of [["cashier-a", 10, 1], ["cashier-b", 20, 1], ["admin", 30, 2]] as const) {
      const tenant = await get("/dashboard/tenant", actor); assert.equal(tenant.status, 200);
      const metrics = await tenant.json() as { revenueToday: number; salesToday: number };
      assert.equal(metrics.revenueToday, revenue); assert.equal(metrics.salesToday, count);
      const chart = await get("/dashboard/metrics?days=30&granularity=day", actor); assert.equal(chart.status, 200);
      const chartData = await chart.json() as { summary: { totalRevenue: number; totalSales: number } };
      assert.equal(chartData.summary.totalRevenue, revenue); assert.equal(chartData.summary.totalSales, count);
      const report = await get("/reports/overview", actor); assert.equal(report.status, 200);
      const overview = await report.json() as { totalRevenue: number; totalSales: number };
      assert.equal(overview.totalRevenue, revenue); assert.equal(overview.totalSales, count);
    }
  });
});
