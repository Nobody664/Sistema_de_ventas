import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '@/database/prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { companyId?: string | null; roles?: string[]; companyStatus?: string } | undefined;

    if (user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('SUPPORT_ADMIN')) {
      return true;
    }

    if (!user?.companyId) {
      throw new ForbiddenException('Tenant context is required for this resource.');
    }

    let companyStatus = user.companyStatus;

    if (!companyStatus && user.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: { status: true },
      });
      companyStatus = company?.status;
    }

    const BLOCKED_MESSAGES: Record<string, string> = {
      SUSPENDED: 'Tu cuenta ha sido suspendida. Contacta al administrador.',
      INACTIVE: 'Tu período de prueba ha expirado. Adquiere un plan para continuar.',
      PAST_DUE: 'Tu suscripción está vencida. Realiza el pago para reactivar tu cuenta.',
    };

    if (BLOCKED_MESSAGES[companyStatus ?? '']) {
      throw new ForbiddenException(BLOCKED_MESSAGES[companyStatus!]);
    }

    request.tenantId = user.companyId as string;
    return true;
  }
}

