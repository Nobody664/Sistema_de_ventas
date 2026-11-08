import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { ForecastService } from "./forecast.service";
import { ReplenishmentService } from "./replenishment.service";

test("incluye productos agotados aunque no tengan punto de reposición", async () => {
  const calls: Prisma.ProductFindManyArgs[] = [];
  const products = [
    {
      id: "out",
      name: "Agotado",
      sku: "OUT",
      stockQuantity: new Prisma.Decimal(0),
      reorderPoint: null,
      safetyStock: null,
      leadTimeDays: null,
    },
    {
      id: "low",
      name: "Bajo",
      sku: "LOW",
      stockQuantity: new Prisma.Decimal(2),
      reorderPoint: new Prisma.Decimal(5),
      safetyStock: null,
      leadTimeDays: 5,
    },
    {
      id: "ok",
      name: "Suficiente",
      sku: "OK",
      stockQuantity: new Prisma.Decimal(10),
      reorderPoint: new Prisma.Decimal(5),
      safetyStock: null,
      leadTimeDays: 5,
    },
  ];
  const prisma = {
    product: {
      findMany: async (args: Prisma.ProductFindManyArgs) => {
        calls.push(args);
        return products;
      },
    },
  };
  const forecast = {
    getDemandAverage: async () => ({ dailyAverage: 1 }),
  };
  const service = new ReplenishmentService(
    prisma as unknown as PrismaService,
    forecast as unknown as ForecastService,
  );

  const result = await service.getSuggestions("company-a");

  assert.deepEqual(calls[0].where, {
    companyId: "company-a",
    deletedAt: null,
    isActive: true,
    OR: [{ stockQuantity: { lte: 0 } }, { reorderPoint: { not: null } }],
  });
  assert.deepEqual(
    result.map((item) => item.productId),
    ["out", "low"],
  );
  assert.equal(result[0].currentStock, 0);
  assert.equal(result[0].reorderPoint, 0);
  assert.equal(result[0].priority, "high");
  assert.ok(result[0].suggestedOrder > 0);
});
