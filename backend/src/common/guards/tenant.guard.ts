import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '@/database/prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
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
      console.log('[TenantGuard] Public endpoint - allowing');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { companyId?: string | null; roles?: string[]; companyStatus?: string } | undefined;

    console.log('[TenantGuard] User:', JSON.stringify(user));

    if (user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('SUPPORT_ADMIN')) {
      console.log('[TenantGuard] Super/Support admin - allowing');
      return true;
    }

    if (!user?.companyId) {
      console.log('[TenantGuard] No companyId - throwing ForbiddenException');
      throw new ForbiddenException('Tenant context is required for this resource.');
    }

    let companyStatus = user.companyStatus;
    
    if (!companyStatus && user.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: { status: true },
      });
      companyStatus = company?.status;
      console.log('[TenantGuard] Queried company status:', companyStatus);
    }

    if (companyStatus === 'SUSPENDED') {
      throw new ForbiddenException('Tu cuenta ha sido suspendida. Contacta al administrador.');
    }

    request.tenantId = user.companyId as string;
    console.log('[TenantGuard] Setting tenantId:', user.companyId);
    return true;
  }
}

