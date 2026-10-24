import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

    if (
      !actor.isPlatform &&
      query.publication &&
      query.publication !== "published"
    )
      throw new ForbiddenException(
        "Los borradores están reservados a plataforma",
      );
    if (
      !actor.isPlatform &&
      query.companyId &&
      query.companyId !== actor.companyId
    )
      throw new ForbiddenException("No puedes consultar FAQs de otra empresa");
    const where: Prisma.SupportFaqWhereInput = this.readScope(actor);
    if (actor.isPlatform)
      where.isPublished =
        query.publication === "all"
          ? undefined
          : query.publication === "draft"
            ? false
            : true;
    if (query.companyId) {
      where.scope = SupportScope.TENANT;
      where.companyId = query.companyId;
    }

    if (query.scope) {
      where.scope = query.scope;
    }

    if (query.category) {
      where.category = query.category;
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
    const faq = await this.prisma.supportFaq.findFirst({
      where: { id, ...this.readScope(actor) },
    });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }

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
    const scope =
      dto.scope ??
      (actor.isPlatform ? SupportScope.GLOBAL : SupportScope.TENANT);
    if (!actor.isPlatform && scope === SupportScope.GLOBAL)
      throw new ForbiddenException("Solo plataforma administra FAQs globales");
    if (!actor.isPlatform && dto.companyId && dto.companyId !== actor.companyId)
      throw new ForbiddenException("No puedes crear FAQs para otra empresa");
    const companyId =
      scope === SupportScope.TENANT
        ? actor.isPlatform
          ? (dto.companyId ?? actor.companyId)
          : actor.companyId
        : null;
    if (scope === SupportScope.GLOBAL && dto.companyId)
      throw new BadRequestException(
        "Una FAQ global no pertenece a una empresa",
      );
    if (scope === SupportScope.TENANT) {
      if (!companyId)
        throw new BadRequestException("La FAQ de empresa requiere un tenant");
      if (
        !(await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true },
        }))
      )
        throw new NotFoundException("Empresa no encontrada");
    }

    return this.prisma.supportFaq.create({
      data: {
        scope,
        companyId,
        category: dto.category ?? null,
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
    this.assertWriteAccess(actor, faq);

    return this.prisma.supportFaq.update({
      where: { id },
      data: {
        question: dto.question ?? undefined,
        answer: dto.answer ?? undefined,
        category: dto.category,
        keywords: dto.keywords?.map((keyword) => keyword.toLowerCase()),
        isPublished: dto.isPublished ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
        updatedById: actor.userId,
      },
    });
  }

  async remove(actor: FaqActor, id: string) {
    const faq = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }
    this.assertWriteAccess(actor, faq);

    await this.prisma.supportFaq.delete({ where: { id } });
    return { ok: true };
  }

  async submitFeedback(actor: FaqActor, id: string, helpful: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportFaq.updateMany({
        where: { id, ...this.readScope(actor), isPublished: true },
        data: helpful
          ? { helpfulCount: { increment: 1 } }
          : { notHelpfulCount: { increment: 1 } },
      });
      if (updated.count !== 1) throw new NotFoundException("FAQ not found.");
      return tx.supportFaq.findUnique({
        where: { id },
        select: { id: true, helpfulCount: true, notHelpfulCount: true },
      });
    });
  }

  private readScope(actor: FaqActor): Prisma.SupportFaqWhereInput {
    if (actor.isPlatform) return {};
    return {
      isPublished: true,
      OR: [
        { scope: SupportScope.GLOBAL, companyId: null },
        ...(actor.companyId
          ? [{ scope: SupportScope.TENANT, companyId: actor.companyId }]
          : []),
      ],
    };
  }

  private assertWriteAccess(
    actor: FaqActor,
    faq: { scope: SupportScope; companyId: string | null },
  ) {
    if (actor.isPlatform) {
      return;
    }
    if (faq.scope === SupportScope.GLOBAL)
      throw new ForbiddenException("Solo plataforma administra FAQs globales");
    if (!actor.companyId || faq.companyId !== actor.companyId) {
      throw new NotFoundException("FAQ not found.");
    }
  }
}
