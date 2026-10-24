import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma, SupportScope } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { SupportFaqService } from "./support-faq.service";

const owner = { userId: "owner", companyId: "company-a", isPlatform: false };
const platform = { userId: "agent", isPlatform: true };

describe("FAQ write boundaries", () => {
  it("does not let a tenant create global content or target another company", async () => {
    const service = new SupportFaqService({} as PrismaService);
    await assert.rejects(
      service.create(owner, {
        question: "Question",
        answer: "Answer",
        scope: "GLOBAL",
      }),
      ForbiddenException,
    );
    await assert.rejects(
      service.create(owner, {
        question: "Question",
        answer: "Answer",
        companyId: "company-b",
      }),
      ForbiddenException,
    );
  });

  it("defaults a company administrator's new content to its own tenant", async () => {
    let data: Prisma.SupportFaqUncheckedCreateInput | undefined;
    const prisma = {
      company: { findUnique: async () => ({ id: "company-a" }) },
      supportFaq: {
        create: async (args: {
          data: Prisma.SupportFaqUncheckedCreateInput;
        }) => {
          data = args.data;
          return args.data;
        },
      },
    };
    const service = new SupportFaqService(prisma as unknown as PrismaService);
    await service.create(owner, { question: "Question", answer: "Answer" });
    assert.equal(data?.scope, "TENANT");
    assert.equal(data?.companyId, "company-a");
  });

  it("allows the platform to create global FAQs without a tenant", async () => {
    const prisma = {
      supportFaq: {
        create: async ({
          data,
        }: {
          data: Prisma.SupportFaqUncheckedCreateInput;
        }) => data,
      },
    };
    const result = await new SupportFaqService(
      prisma as unknown as PrismaService,
    ).create(platform, { question: "Question", answer: "Answer" });
    assert.equal(result.scope, "GLOBAL");
    assert.equal(result.companyId, null);
  });

  it("rejects updating and deleting a global FAQ as a company administrator", async () => {
    const service = new SupportFaqService({
      supportFaq: {
        findUnique: async () => ({
          id: "faq",
          scope: "GLOBAL",
          companyId: null,
        }),
      },
    } as unknown as PrismaService);
    await assert.rejects(
      service.update(owner, "faq", { answer: "modified" }),
      ForbiddenException,
    );
    await assert.rejects(service.remove(owner, "faq"), ForbiddenException);
  });

  it("hides other tenants' writable FAQs", async () => {
    const service = new SupportFaqService({
      supportFaq: {
        findUnique: async () => ({
          id: "faq",
          scope: "TENANT",
          companyId: "company-b",
        }),
      },
    } as unknown as PrismaService);
    await assert.rejects(
      service.update(owner, "faq", { answer: "modified" }),
      NotFoundException,
    );
    await assert.rejects(service.remove(owner, "faq"), NotFoundException);
  });
});

describe("FAQ reading and feedback", () => {
  it("requires published content and applies tenant scope when reading by ID", async () => {
    let where: Prisma.SupportFaqWhereInput | undefined;
    const service = new SupportFaqService({
      supportFaq: {
        findFirst: async (query: { where: Prisma.SupportFaqWhereInput }) => {
          where = query.where;
          return null;
        },
      },
    } as unknown as PrismaService);
    await assert.rejects(
      service.findById(owner, "private-faq"),
      NotFoundException,
    );
    assert.equal(where?.isPublished, true);
    assert.deepEqual(where?.OR, [
      { scope: SupportScope.GLOBAL, companyId: null },
      { scope: SupportScope.TENANT, companyId: "company-a" },
    ]);
  });

  it("does not permit a tenant to request drafts or another company's list", async () => {
    const service = new SupportFaqService({} as PrismaService);
    await assert.rejects(
      service.findAll(owner, { publication: "draft" }),
      ForbiddenException,
    );
    await assert.rejects(
      service.findAll(owner, { companyId: "company-b" }),
      ForbiddenException,
    );
  });

  it("returns only counters from feedback and checks visibility in the same transaction", async () => {
    let where: Prisma.SupportFaqWhereInput | undefined;
    let select: Prisma.SupportFaqSelect | undefined;
    const tx = {
      supportFaq: {
        updateMany: async (query: { where: Prisma.SupportFaqWhereInput }) => {
          where = query.where;
          return { count: 1 };
        },
        findUnique: async (query: { select: Prisma.SupportFaqSelect }) => {
          select = query.select;
          return { id: "faq", helpfulCount: 1, notHelpfulCount: 0 };
        },
      },
    };
    const service = new SupportFaqService({
      $transaction: async <T>(work: (client: typeof tx) => Promise<T>) =>
        work(tx),
    } as unknown as PrismaService);
    const result = await service.submitFeedback(owner, "faq", true);
    assert.equal(where?.isPublished, true);
    assert.deepEqual(where?.OR, [
      { scope: "GLOBAL", companyId: null },
      { scope: "TENANT", companyId: "company-a" },
    ]);
    assert.deepEqual(select, {
      id: true,
      helpfulCount: true,
      notHelpfulCount: true,
    });
    assert.deepEqual(result, {
      id: "faq",
      helpfulCount: 1,
      notHelpfulCount: 0,
    });
  });

  it("does not return hidden FAQ content through feedback", async () => {
    const tx = { supportFaq: { updateMany: async () => ({ count: 0 }) } };
    const service = new SupportFaqService({
      $transaction: async <T>(work: (client: typeof tx) => Promise<T>) =>
        work(tx),
    } as unknown as PrismaService);
    await assert.rejects(
      service.submitFeedback(owner, "other-tenant", true),
      NotFoundException,
    );
  });
});
