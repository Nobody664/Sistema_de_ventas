import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, ROLE_PERMISSIONS } from '../constants/permissions.constant';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRoles: string[] = request.user?.roles ?? [];

    if (userRoles.includes('SUPER_ADMIN')) {
      return true;
    }

    const userPermissions = new Set<Permission>();
    for (const role of userRoles) {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (rolePerms) {
        for (const p of rolePerms) {
          userPermissions.add(p);
        }
      }
    }

    const hasAll = requiredPermissions.every((p) => userPermissions.has(p));

    if (!hasAll) {
      throw new ForbiddenException('No tienes permisos para realizar esta accion.');
    }

    return true;
  }
}
