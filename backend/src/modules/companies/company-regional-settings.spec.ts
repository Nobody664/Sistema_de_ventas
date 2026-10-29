import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  companyDateKey,
  companyDay,
  companyMidnight,
  companyTimeZone,
} from "@/common/helpers/company-timezone.helper";
import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { ReportsService } from "@/modules/reports/reports.service";
import { CompaniesService } from "./companies.service";
import { UpdateCompanyDto } from "./dto/company.dto";

describe("Company calendar boundaries", () => {
  it("uses the company day, not the server day, around midnight", () => {
    const instant = new Date("2026-11-01T05:30:00Z");
    const lima = companyDay(instant, "America/Lima");
    const mexico = companyDay(instant, "America/Mexico_City");
    assert.equal(lima.key, "2026-11-01");
    assert.equal(lima.start.toISOString(), "2026-11-01T05:00:00.000Z");
    assert.equal(mexico.key, "2026-10-31");
    assert.equal(mexico.start.toISOString(), "2026-10-31T06:00:00.000Z");
    assert.equal(mexico.end.toISOString(), "2026-11-01T06:00:00.000Z");
  });
  it("handles calendar days with 23 or 25 hours", () => {
    const start = companyMidnight("2022-04-03", "America/Mexico_City");
    const end = companyMidnight("2022-04-04", "America/Mexico_City");
    assert.equal((end.getTime() - start.getTime()) / 3600000, 23);
    const autumnStart = companyMidnight("2022-10-30", "America/Mexico_City");
    const autumnEnd = companyMidnight("2022-10-31", "America/Mexico_City");
    assert.equal((autumnEnd.getTime() - autumnStart.getTime()) / 3600000, 25);
  });
  it("finds the first valid instant when midnight is skipped", () => {
    const start = companyMidnight("2026-09-06", "America/Santiago");
    assert.equal(start.toISOString(), "2026-09-06T04:00:00.000Z");
    assert.equal(companyDateKey(start, "America/Santiago"), "2026-09-06");
  });
  it("keeps legacy invalid timezone values from breaking read paths", () => {
    assert.equal(companyTimeZone("Invalid/Zone"), "America/Lima");
    assert.equal(companyTimeZone(undefined), "America/Lima");
  });
});

describe("Company settings writes", () => {
  const existing = {
    id: "company-a",
    name: "Empresa",
    currency: "PEN",
    timezone: "America/Lima",
  };
  it("validates the IANA timezone and rejects a tenant id supplied in the payload", async () => {
    assert.equal(
      (
        await validate(
          plainToInstance(UpdateCompanyDto, {
            timezone: "America/Mexico_City",
          }),
        )
      ).length,
      0,
    );
    assert.ok(
      (
        await validate(
          plainToInstance(UpdateCompanyDto, { timezone: "Invalid/Zone" }),
        )
      ).length > 0,
    );
    assert.ok(
      (
        await validate(
          plainToInstance(UpdateCompanyDto, {
            timezone: "America/Lima",
            companyId: "other-company",
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).length > 0,
    );
  });
  it("updates only the authenticated company and preserves its currency", async () => {
    const service = new CompaniesService({
      company: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          assert.equal(where.id, existing.id);
          return existing;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          assert.equal(where.id, existing.id);
          assert.equal(data.timezone, "America/Mexico_City");
          assert.equal(data.currency, undefined);
          return { ...existing, ...data };
        },
      },
    } as unknown as PrismaService);
    const result = await service.updateCurrent(existing.id, {
      timezone: "America/Mexico_City",
    });
    assert.equal(result.timezone, "America/Mexico_City");
    assert.equal(result.currency, "PEN");
  });
  it("rejects direct currency changes and invalid zones before writing", async () => {
    const service = new CompaniesService({
      company: {
        findUnique: async () => existing,
        update: async () => {
          throw new Error("Must not write");
        },
      },
    } as unknown as PrismaService);
    await assert.rejects(
      service.updateCurrent(existing.id, { currency: "USD" }),
      BadRequestException,
    );
    await assert.rejects(
      service.updateCurrent(existing.id, { timezone: "Invalid/Zone" }),
      BadRequestException,
    );
  });
});

describe("Regional metric reads", () => {
  it("recomputes today and does not reuse cached metrics from another timezone", async (context) => {
    context.mock.timers.enable({
      apis: ["Date"],
      now: Date.parse("2026-11-01T05:30:00Z"),
    });
    let timezone = "America/Lima";
    const ranges: { gte: Date; lt: Date }[] = [];
    const memory = new Map<string, unknown>();
    const prisma = {
      company: {
        findUnique: async () => ({
          id: "company",
          name: "Empresa",
          currency: "PEN",
          timezone,
          updatedAt: new Date("2026-01-01"),
        }),
      },
      sale: {
        aggregate: async ({
          where,
        }: {
          where: { createdAt?: { gte: Date; lt?: Date } };
        }) => {
          if (where.createdAt?.lt)
            ranges.push({ gte: where.createdAt.gte, lt: where.createdAt.lt });
          return { _sum: { totalAmount: 0 }, _count: { id: 0 } };
        },
        findMany: async () => [],
      },
      product: { count: async () => 0, findMany: async () => [] },
      customer: { count: async () => 0 },
      employee: { count: async () => 0 },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma, {
      get: async (key: string) => memory.get(key),
      set: async (key: string, value: unknown) => {
        memory.set(key, value);
      },
    } as never);
    const actor = { userId: "owner", roles: ["COMPANY_ADMIN"] };
    await service.getTenantMetrics("company", actor);
    timezone = "America/Mexico_City";
    await service.getTenantMetrics("company", actor);
    assert.equal(ranges.length, 2);
    assert.equal(ranges[0].gte.toISOString(), "2026-11-01T05:00:00.000Z");
    assert.equal(ranges[1].gte.toISOString(), "2026-10-31T06:00:00.000Z");
  });
  it("interprets date-only report filters as local calendar dates", async () => {
    const ranges: Record<string, unknown>[] = [];
    const prisma = {
      company: {
        findUnique: async () => ({ timezone: "America/Mexico_City" }),
      },
      sale: {
        count: async ({
          where,
        }: {
          where: { createdAt: Record<string, unknown> };
        }) => {
          ranges.push(where.createdAt);
          return 0;
        },
        aggregate: async () => ({
          _sum: { totalAmount: 0 },
          _count: { id: 0 },
        }),
        groupBy: async () => [],
      },
      customer: { count: async () => 0 },
      saleItem: { groupBy: async () => [] },
      product: { findMany: async () => [] },
    } as unknown as PrismaService;
    await new ReportsService(prisma, {
      get: async () => null,
      set: async () => undefined,
    } as never).getSalesOverview(
      "company",
      { startDate: "2026-10-07", endDate: "2026-10-07" },
      { userId: "owner", roles: ["COMPANY_ADMIN"] },
    );
    assert.equal(
      (ranges[0].gte as Date).toISOString(),
      "2026-10-07T06:00:00.000Z",
    );
    assert.equal(
      (ranges[0].lte as Date).toISOString(),
      "2026-10-08T05:59:59.999Z",
    );
  });
});
