import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class StoreCloseoutGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{
        user?: { companyId?: string; roles?: string[] };
        tenantId?: string;
      }>();
    if (!req.user?.companyId || !req.user.roles?.includes("COMPANY_ADMIN"))
      throw new ForbiddenException("Se requiere administrador de esta empresa");
    req.tenantId = req.user.companyId;
    return true;
  }
}
