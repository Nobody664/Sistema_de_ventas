import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { plainToInstance } from "class-transformer";
import { paidPlanDefaults } from "./paid-plan-policy";
import { PlansService } from "@/modules/plans/plans.service";
import { UpdatePlanDto } from "@/modules/plans/dto/plan.dto";
import { PlanCapabilitiesService } from "./plan-capabilities.service";

test("Start, Medio y Profesional reciben cuotas iniciales, sin pisar la cuota guardada por Super-Admin", () => {
  for (const [code, quota] of [
    ["START", 500],
    ["GROWTH", 1500],
    ["SCALE", 3000],
    ["MEDIO", 1500],
    ["PROFESIONAL", 3000],
  ] as const) {
    const plan = paidPlanDefaults({
      code,
      priceMonthly: 99,
      modules: ["sales"],
      permissions: ["reports.basic"],
    });
    assert.equal(plan.apiQuota, quota);
    assert.ok(plan.modules.includes("storefront"));
    assert.ok(plan.modules.includes("api_search_dni"));
    assert.ok(plan.modules.includes("sales"));
    assert.ok(plan.permissions.includes("api.dni_search"));
    assert.equal(plan.modules.includes("api"), false);
    assert.equal(
      paidPlanDefaults({ code, priceMonthly: 99, apiQuota: 777 }).apiQuota,
      777,
    );
  }
});

test("modificar solo la cuota preserva el plan y afecta la caché de todas sus empresas", async () => {
  const old = {
    id: "p",
    code: "GROWTH",
    name: "Medio",
    priceMonthly: new Prisma.Decimal(199),
    priceYearly: new Prisma.Decimal(1990),
    modules: ["sales"],
    permissions: ["reports.basic"],
    apiQuota: 1500,
  };
  let data: Record<string, unknown> = {};
  const invalidated: string[] = [];
  const service = new PlansService(
    {
      plan: {
        findUnique: async () => old,
        update: async (args: { data: Record<string, unknown> }) => {
          data = args.data;
          return { ...old, ...args.data };
        },
      },
      subscription: {
        findMany: async () => [
          { id: "s1", companyId: "a" },
          { id: "s2", companyId: "b" },
        ],
      },
    } as never,
    {
      invalidate: async (id: string) => {
        invalidated.push(id);
      },
    } as never,
  );
  await service.update("p", plainToInstance(UpdatePlanDto, { apiQuota: 1800 }));
  assert.equal(data.apiQuota, 1800);
  assert.ok((data.modules as string[]).includes("sales"));
  assert.ok((data.modules as string[]).includes("storefront"));
  assert.deepEqual(invalidated.sort(), ["a", "b"]);
  await assert.rejects(service.update("p", { apiQuota: 0 }));
  await assert.rejects(service.update("p", { apiQuota: null } as never));
});

test("solo un pago positivo confirmado con suscripción vigente concede tienda y DNI", async () => {
  const plan = {
    id: "p",
    code: "SCALE",
    name: "Profesional",
    priceMonthly: new Prisma.Decimal(399),
    priceYearly: new Prisma.Decimal(4700),
    modules: ["sales", "storefront", "api_search_dni"],
    permissions: ["api.dni_search"],
    apiEnabled: true,
    apiSearchDniEnabled: true,
    apiQuota: 3000,
    maxUsers: 10,
    maxProducts: 100,
  };
  for (const scenario of [
    "paid",
    "pending",
    "trial",
    "expired",
    "suspended",
  ] as const) {
    const subscription = {
      status: scenario === "trial" ? "TRIALING" : "ACTIVE",
      plan,
      endDate: new Date(Date.now() + (scenario === "expired" ? -1 : 3600000)),
      company: { status: scenario === "suspended" ? "SUSPENDED" : "ACTIVE" },
      payments: scenario === "pending" ? [] : [{ id: "confirmed" }],
    };
    const service = new PlanCapabilitiesService(
      { subscription: { findFirst: async () => subscription } } as never,
      { get: async () => null, set: async () => undefined } as never,
    );
    const capabilities = await service.getCapabilities("company");
    assert.equal(
      capabilities.modules.includes("storefront"),
      scenario === "paid",
    );
    assert.equal(capabilities.apiSearchDniEnabled, scenario === "paid");
    assert.equal(capabilities.apiQuota, scenario === "paid" ? 3000 : 0);
  }
});

test("la migración actualiza planes antiguos sin modificar precios ni reiniciar consumo", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE plans(code TEXT PRIMARY KEY,price_monthly NUMERIC,price_yearly NUMERIC,modules JSONB,permissions JSONB,api_enabled BOOLEAN,api_search_dni_enabled BOOLEAN,api_quota INTEGER);
      INSERT INTO plans VALUES ('FREE',0,0,'["sales"]','[]',false,false,0),('START',99,1090,'["sales"]','[]',false,false,0),('GROWTH',199,2300,'["api"]','["reports.advanced"]',true,false,10000),('SCALE',399,4700,'["webhooks"]','[]',true,true,100000);
      CREATE TABLE api_usage(company_id TEXT, count INTEGER); INSERT INTO api_usage VALUES ('existing',250);`);
    await db.exec(
      readFileSync(
        resolve(
          "prisma/migrations/20261114000000_paid_storefront_dni/migration.sql",
        ),
        "utf8",
      ),
    );
    const rows = (
      await db.query<{
        code: string;
        api_quota: number;
        modules: string[];
        price_monthly: string;
      }>("SELECT * FROM plans ORDER BY price_monthly")
    ).rows;
    assert.deepEqual(
      rows.map((row) => row.api_quota),
      [0, 500, 1500, 3000],
    );
    assert.deepEqual(
      rows.map((row) => row.price_monthly),
      ["0", "99", "199", "399"],
    );
    assert.ok(rows[3].modules.includes("webhooks"));
    assert.equal(
      (await db.query<{ count: number }>("SELECT count FROM api_usage")).rows[0]
        .count,
      250,
    );
    await db.exec("UPDATE plans SET api_quota=1700 WHERE code='GROWTH'");
    assert.equal(
      (
        await db.query<{ api_quota: number }>(
          "SELECT api_quota FROM plans WHERE code='GROWTH'",
        )
      ).rows[0].api_quota,
      1700,
    );
  } finally {
    await db.close();
  }
});
