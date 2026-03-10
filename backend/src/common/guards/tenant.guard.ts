import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { companyId?: string | null; roles?: string[] } | undefined;

    if (user?.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    if (!user?.companyId) {
      throw new ForbiddenException('Tenant context is required for this resource.');
    }

    request.tenantId = user.companyId;
    return true;
  }
}

