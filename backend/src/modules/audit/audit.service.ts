import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  findRecent(companyId?: string) {
    return this.prisma.auditLog.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

