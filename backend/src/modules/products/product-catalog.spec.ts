import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { QueryProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";

function fixture() {
  const calls: Prisma.ProductFindManyArgs[] = [];
  const counts: Prisma.ProductCountArgs[] = [];
  const row = {
    id: "old-product",
    categoryId: "category-b",
    category: { id: "category-b", name: "B" },
  };
  const prisma = {
    product: {
      findMany: async (args: Prisma.ProductFindManyArgs) => {
        calls.push(args);
        return [row];
      },
      count: async (args: Prisma.ProductCountArgs) => {
        counts.push(args);
        return 105;
      },
    },
  };
  const service = new ProductsService(
    prisma as unknown as PrismaService,
    {} as SubscriptionLimitService,
    {} as LowStockService,
    {} as AuditService,
  );
  return { service, calls, counts, row };
}

describe("Product catalog filtering", () => {
  it("filters the complete tenant catalog before pagination and returns categoryId", async () => {
    const { service, calls, counts, row } = fixture();
    const result = await service.findCatalog("company-a", {
      categoryId: "category-b",
      page: 2,
      limit: 50,
    });
    assert.deepEqual(calls[0].where, {
      companyId: "company-a",
      deletedAt: null,
      categoryId: "category-b",
    });
    assert.deepEqual(counts[0].where, calls[0].where);
    assert.equal(calls[0].skip, 50);
    assert.equal(calls[0].take, 50);
    assert.equal(calls[0].select?.categoryId, true);
    assert.deepEqual(result.data, [row]);
    assert.equal(result.total, 105);
    assert.equal(result.totalPages, 3);
  });
  it("combines search and active status without dropping the company or category scope", async () => {
    const { service, calls } = fixture();
    await service.findCatalog("company-a", {
      categoryId: "foreign-category",
      search: "  SKU-99  ",
      isActive: "true",
    });
    assert.deepEqual(calls[0].where, {
      companyId: "company-a",
      deletedAt: null,
      categoryId: "foreign-category",
      isActive: true,
      OR: ["name", "sku", "barcode", "description"].map((field) => ({
        [field]: { contains: "SKU-99", mode: "insensitive" },
      })),
    });
  });
  it("preserves the legacy array response for existing product selectors", async () => {
    const { service, calls, row } = fixture();
    assert.deepEqual(await service.findByCompany("company-a"), [row]);
    assert.equal(calls[0].select?.categoryId, true);
    assert.equal(calls[0].take, 50);
  });
  it("accepts category and search filters but rejects oversized pages and tenant spoofing", async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    assert.equal(
      (
        await validate(
          plainToInstance(QueryProductDto, {
            categoryId: "cat-1",
            search: "galletas",
            page: "2",
            limit: "50",
          }),
          options,
        )
      ).length,
      0,
    );
    assert.ok(
      (
        await validate(
          plainToInstance(QueryProductDto, {
            limit: "500",
            page: "0",
            companyId: "other-company",
          }),
          options,
        )
      ).length > 0,
    );
  });
});
