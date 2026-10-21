import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { Prisma, SupportScope } from "@prisma/client";
import { CreateFaqDto, QueryFaqDto, UpdateFaqDto } from "./dto/faq.dto";

export interface FaqActor {
  userId: string;
  companyId?: string | null;
  isPlatform: boolean;
}

@Injectable()
export class SupportFaqService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: FaqActor, query: QueryFaqDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const orFilters: Prisma.SupportFaqWhereInput[] = [
      { scope: SupportScope.GLOBAL },
    ];
    if (actor.companyId) {
      orFilters.push({
        scope: SupportScope.TENANT,
        companyId: actor.companyId,
      });
    }

    const where: Prisma.SupportFaqWhereInput = {
      isPublished: true,
      OR: orFilters,
    };

    if (query.scope) {
      where.scope = query.scope;
    }

    if (query.q) {
      where.AND = [
        {
          OR: [
            { question: { contains: query.q, mode: "insensitive" } },
            { answer: { contains: query.q, mode: "insensitive" } },
            { keywords: { has: query.q.toLowerCase() } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.supportFaq.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      this.prisma.supportFaq.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(actor: FaqActor, id: string) {
    const faq = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }
    this.assertAccess(actor, faq);

    await this.prisma.supportFaq.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return faq;
  }

  async search(actor: FaqActor, term: string) {
    const result = await this.findAll(actor, { q: term, limit: 10 });
    return result.data;
  }

  async create(actor: FaqActor, dto: CreateFaqDto) {
    const scope = dto.scope ?? SupportScope.GLOBAL;
    const companyId =
      scope === SupportScope.TENANT ? (dto.companyId ?? actor.companyId) : null;

    return this.prisma.supportFaq.create({
      data: {
        scope,
        companyId,
        question: dto.question,
        answer: dto.answer,
        keywords: (dto.keywords ?? []).map((keyword) => keyword.toLowerCase()),
        isPublished: dto.isPublished ?? true,
        sortOrder: dto.sortOrder ?? 0,
        createdById: actor.userId,
      },
    });
  }

  async update(actor: FaqActor, id: string, dto: UpdateFaqDto) {
    const faq = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }
    this.assertAccess(actor, faq);

    return this.prisma.supportFaq.update({
      where: { id },
      data: {
        question: dto.question,
        answer: dto.answer,
        keywords: dto.keywords?.map((keyword) => keyword.toLowerCase()),
        isPublished: dto.isPublished,
        sortOrder: dto.sortOrder,
        updatedById: actor.userId,
      },
    });
  }

  async remove(actor: FaqActor, id: string) {
    const faq = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }
    this.assertAccess(actor, faq);

    await this.prisma.supportFaq.delete({ where: { id } });
    return { ok: true };
  }

  async submitFeedback(id: string, helpful: boolean) {
    const faq = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }

    return this.prisma.supportFaq.update({
      where: { id },
      data: helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
    });
  }

  private assertAccess(
    actor: FaqActor,
    faq: { scope: SupportScope; companyId: string | null },
  ) {
    if (actor.isPlatform || faq.scope === SupportScope.GLOBAL) {
      return;
    }
    if (faq.companyId !== actor.companyId) {
      throw new NotFoundException("FAQ not found.");
    }
  }
}
