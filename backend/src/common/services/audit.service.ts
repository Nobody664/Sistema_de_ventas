import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { AuditContextService } from './audit-context.service';

export type AuditClient = PrismaService | Prisma.TransactionClient;

export interface AuditLogInput {
  companyId: string;
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQueryOptions {
  companyId?: string;
  userId?: string;
  entity?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContext: AuditContextService,
  ) {}

  async log(input: AuditLogInput, client?: AuditClient): Promise<void> {
    const db = client ?? this.prisma;
    const context = this.auditContext.get();
    const changes =
      input.changes === undefined || input.changes === null
        ? undefined
        : (JSON.parse(JSON.stringify(input.changes)) as Prisma.InputJsonValue);

    try {
      await db.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId ?? context?.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          changes,
          ipAddress: input.ipAddress ?? context?.ipAddress ?? null,
          userAgent: input.userAgent ?? context?.userAgent ?? null,
        },
      });
    } catch (error) {
      if (client) {
        throw error;
      }

      this.logger.error(
        `Audit log failed for ${input.entity}:${input.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async findMany(options: AuditQueryOptions) {
    const page = Math.max(options.page ?? 1, 1);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    const where: Prisma.AuditLogWhereInput = {
      companyId: options.companyId,
      userId: options.userId,
      entity: options.entity,
      action: options.action,
      createdAt:
        options.from || options.to
          ? {
              gte: options.from,
              lte: options.to,
            }
          : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}