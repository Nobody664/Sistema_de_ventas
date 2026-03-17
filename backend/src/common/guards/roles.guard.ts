import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log('RolesGuard:', { requiredRoles });

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRoles: string[] = request.user?.roles ?? [];

    console.log('RolesGuard:', { userRoles, requiredRoles, hasAccess: requiredRoles.some((role) => userRoles.includes(role)) });

    const hasAccess = requiredRoles.some((role) => userRoles.includes(role));
    
    if (!hasAccess) {
      throw new ForbiddenException('No tienes permisos para acceder a este recurso.');
    }

    return hasAccess;
  }
}

