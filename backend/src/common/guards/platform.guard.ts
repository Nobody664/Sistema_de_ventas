import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

export const PLATFORM_ROLES = ['SUPER_ADMIN', 'SUPPORT_ADMIN'] as const;

@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const roles: string[] = request.user?.roles ?? [];

    const isPlatformAdmin = roles.some((role) =>
      (PLATFORM_ROLES as readonly string[]).includes(role),
    );

    if (!isPlatformAdmin) {
      throw new ForbiddenException('Se requieren permisos de plataforma.');
    }

    return true;
  }
}
