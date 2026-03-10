import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  findByCompany(companyId: string) {
    return this.prisma.subscription.findFirst({
      where: { companyId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

