import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { AuditContextService } from '@/common/services/audit-context.service';

export interface PlatformAuditInput {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  changes?: unknown;
}

@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContext: AuditContextService,
  ) {}

  async log(input: PlatformAuditInput): Promise<void> {
    const context = this.auditContext.get();
    const changes =
      input.changes === undefined || input.changes === null
        ? undefined
        : (JSON.parse(JSON.stringify(input.changes)) as Prisma.InputJsonValue);

    try {
      await this.prisma.platformAuditLog.create({
        data: {
          actorId: input.actorId ?? context?.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          changes,
          ipAddress: context?.ipAddress ?? null,
          userAgent: context?.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Platform audit log failed for ${input.entity}:${input.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
