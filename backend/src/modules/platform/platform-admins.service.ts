import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@/database/prisma/prisma.service';

const PLATFORM_ROLES = ['SUPER_ADMIN', 'SUPPORT_ADMIN'] as const;

@Injectable()
export class PlatformAdminsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      where: { globalRole: { in: [...PLATFORM_ROLES] } },
      select: {
        id: true,
        email: true,
        fullName: true,
        globalRole: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  listCandidates(query?: string) {
    return this.prisma.user.findMany({
      where: {
        globalRole: 'USER',
        ...(query
          ? {
              OR: [
                { email: { contains: query, mode: 'insensitive' as const } },
                { fullName: { contains: query, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async grantSupportAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario #${userId} no encontrado`);
    }
    if (user.globalRole === 'SUPER_ADMIN') {
      throw new BadRequestException('No se puede modificar a un SUPER_ADMIN.');
    }
    if (user.globalRole === 'SUPPORT_ADMIN') {
      return user;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { globalRole: 'SUPPORT_ADMIN' },
    });
  }

  async revokeAdmin(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario #${userId} no encontrado`);
    }
    if (user.globalRole === 'SUPER_ADMIN') {
      throw new BadRequestException('No se puede revocar a un SUPER_ADMIN.');
    }
    if (userId === actorId) {
      throw new BadRequestException('No puedes revocar tu propio acceso.');
    }
    if (user.globalRole !== 'SUPPORT_ADMIN') {
      return user;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { globalRole: 'USER' },
    });
  }
}
