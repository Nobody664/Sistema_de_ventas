import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, ProductExpiryProfile } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { ExpiryAlertsService } from "./expiry-alerts.service";

const instant = new Date("2026-10-31T15:00:00Z");
type Alert = Prisma.ProductExpiryAlertCreateManyInput;
type Batch = { id: string; companyId: string; productId: string; batchNumber: string; quantityAvailable: Prisma.Decimal; expirationDate: Date | null };

function fixture() {
  const product = { id: "product-a", companyId: "company-a", name: "Atún en conserva", baseUnit: "UNIT", isActive: true, deletedAt: null as Date | null, stockQuantity: new Prisma.Decimal(10), expiryDate: new Date("2026-11-02T00:00:00Z"), expiryProfile: "LONG_LIFE" as ProductExpiryProfile, expiryWarningDays: null, company: { timezone: "America/Lima", status: "ACTIVE" }, batches: [] as Array<{ id: string }> };
  const batches: Batch[] = [];
  const membership = { id: "member-a", companyId: "company-a", userId: "user-a", isActive: true, role: "COMPANY_ADMIN", notificationStock: true, user: { isActive: true } };
  let alerts = new Map<string, Alert>();
  const outbox = new Map<string, Record<string, unknown>>();
  const delivered: Array<Record<string, unknown>> = [];
  const state = { failOutbox: false, productQueries: [] as Array<Record<string, unknown>>, batchQueries: [] as Array<Record<string, unknown>> };
  const syncBatches = (): void => { product.batches = batches.filter((batch) => batch.quantityAvailable.gt(0)).map((batch) => ({ id: batch.id })); };
  const prisma = {
    product: {
      findFirst: async ({ where }: { where: { id: string; companyId: string; isActive?: boolean } }) => { syncBatches(); return where.id === product.id && where.companyId === product.companyId && (!where.isActive || product.isActive && !product.deletedAt && product.stockQuantity.gt(0)) ? product : null; },
      findMany: async (args: Record<string, unknown>) => { syncBatches(); state.productQueries.push(args); return product.isActive && !product.deletedAt && product.stockQuantity.gt(0) && !product.batches.length ? [product] : []; },
    },
    productBatch: {
      findMany: async (args: Record<string, unknown>) => { state.batchQueries.push(args); syncBatches(); return batches.filter((batch) => batch.quantityAvailable.gt(0)).map((batch) => ({ ...batch, product })); },
      findFirst: async ({ where }: { where: { id: string; productId: string; companyId: string } }) => batches.find((batch) => batch.id === where.id && batch.companyId === where.companyId && batch.productId === where.productId && batch.quantityAvailable.gt(0)) ?? null,
      count: async () => batches.filter((batch) => batch.quantityAvailable.gt(0)).length,
    },
    membership: { findMany: async ({ where }: { where: { companyId: { in: string[] } } }) => membership.isActive && membership.user.isActive && membership.notificationStock && where.companyId.in.includes(membership.companyId) ? [membership] : [] },
    productExpiryAlert: {
      findMany: async ({ where }: { where: { eventKey?: { in: string[] }; id?: { in: string[] } } }) => [...alerts.values()].filter((row) => where.eventKey ? where.eventKey.in.includes(row.eventKey) : where.id!.in.includes(row.id)),
      createMany: async ({ data }: { data: Alert[] }) => { for (const row of data) if (![...alerts.values()].some((existing) => existing.eventKey === row.eventKey)) alerts.set(row.id, row); },
      findUnique: async ({ where }: { where: { id: string } }) => { syncBatches(); const row = alerts.get(where.id); return row ? { ...row, product, membership } : null; },
    },
    outboxEvent: { createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { if (state.failOutbox) throw new Error("outbox unavailable"); for (const row of data) outbox.set(String(row.dedupeKey), row); } },
    $transaction: async <T>(work: (tx: unknown) => Promise<T>) => { const snapshot = new Map(alerts); try { return await work(prisma); } catch (error) { alerts = snapshot; throw error; } },
  };
  const service = new ExpiryAlertsService(prisma as unknown as PrismaService, { create: async (input: Record<string, unknown>) => { delivered.push(input); } } as unknown as NotificationsService);
  return { service, product, membership, batches, outbox, delivered, state, alerts: () => [...alerts.values()] };
}

describe("Durable product expiry alerts", () => {
  it("preserves receipts across reading/deleting notifications and concurrent sweeps", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: instant });
    const { service, alerts, outbox, delivered } = fixture();
    const results = await Promise.all([service.checkProduct("company-a", "product-a"), service.checkProduct("company-a", "product-a")]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(alerts().length, 1);
    assert.equal(outbox.size, 1);
    await service.deliver(alerts()[0].id);
    assert.equal(delivered.length, 1);
    delivered.length = 0;
    assert.equal(await service.checkProduct("company-a", "product-a"), false);
    assert.equal(outbox.size, 1);
  });
  it("rolls back a receipt if its durable event cannot be stored, then recovers on retry", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: instant });
    const { service, alerts, state, outbox } = fixture();
    state.failOutbox = true;
    await assert.rejects(service.checkProduct("company-a", "product-a"), /outbox unavailable/);
    assert.equal(alerts().length, 0);
    state.failOutbox = false;
    assert.equal(await service.checkProduct("company-a", "product-a"), true);
    assert.equal(outbox.size, 1);
  });
  it("creates an expired alert even when a previous near-expiry notice exists", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: instant });
    const { service, product, alerts, delivered } = fixture();
    await service.checkProduct("company-a", "product-a");
    await service.deliver(alerts()[0].id);
    context.mock.timers.setTime(new Date("2026-11-03T15:00:00Z").getTime());
    await service.checkProduct("company-a", "product-a");
    assert.equal(alerts().length, 2);
    await service.deliver(alerts()[1].id);
    assert.equal(delivered[1].type, "PRODUCT_EXPIRED");
    assert.equal(delivered[1].actionUrl, `/products/${product.id}`);
    assert.match(String(delivered[1].message), /venció hace 1 día/);
  });
  it("monitors each remaining batch rather than the product's last receipt date", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: instant });
    const { service, product, batches, alerts, delivered } = fixture();
    product.expiryDate = new Date("2030-01-01T00:00:00Z");
    batches.push(
      { id: "batch-expired", companyId: "company-a", productId: product.id, batchNumber: "ANTIGUO", quantityAvailable: new Prisma.Decimal(2), expirationDate: new Date("2026-10-30") },
      { id: "batch-soon", companyId: "company-a", productId: product.id, batchNumber: "PRÓXIMO", quantityAvailable: new Prisma.Decimal(3), expirationDate: new Date("2026-12-15") },
      { id: "batch-empty", companyId: "company-a", productId: product.id, batchNumber: "AGOTADO", quantityAvailable: new Prisma.Decimal(0), expirationDate: new Date("2026-10-20") },
    );
    await service.scan();
    assert.deepEqual(alerts().map((alert) => alert.batchId).sort(), ["batch-expired", "batch-soon"]);
    for (const alert of alerts()) await service.deliver(alert.id);
    assert.ok(delivered.some((notice) => notice.type === "PRODUCT_EXPIRED" && String(notice.message).includes("ANTIGUO")));
  });
  it("discards queued notices if stock, label date, membership or preferences have changed", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: instant });
    for (const change of [
      (f: ReturnType<typeof fixture>) => { f.product.stockQuantity = new Prisma.Decimal(0); },
      (f: ReturnType<typeof fixture>) => { f.product.expiryDate = new Date("2030-01-01"); },
      (f: ReturnType<typeof fixture>) => { f.membership.notificationStock = false; },
      (f: ReturnType<typeof fixture>) => { f.membership.companyId = "company-b"; },
      (f: ReturnType<typeof fixture>) => { f.membership.user.isActive = false; },
    ]) {
      const f = fixture();
      await f.service.checkProduct("company-a", "product-a");
      change(f);
      await f.service.deliver(f.alerts()[0].id);
      assert.equal(f.delivered.length, 0);
    }
  });
  it("keeps access and recipients tenant-scoped and allows inspection of undated lots", async (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: instant });
    const f = fixture();
    await assert.rejects(f.service.inspectProduct("company-b", "product-a"), /Producto no encontrado/);
    f.membership.notificationStock = false;
    assert.equal(await f.service.checkProduct("company-a", "product-a"), false);
    f.batches.push({ id: "undated", companyId: "company-a", productId: "product-a", batchNumber: "SIN-FECHA", quantityAvailable: new Prisma.Decimal(1), expirationDate: null });
    const result = await f.service.inspectProduct("company-a", "product-a");
    assert.equal(result.sources[0].dateKey, null);
    assert.equal(result.totalBatches, 1);
    assert.equal(result.sources[0].stage, null);
  });
});
