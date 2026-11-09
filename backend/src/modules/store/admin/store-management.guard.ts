import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  StoreAdminContextService,
  StoreAdminUser,
} from "./store-admin-context.service";

@Injectable()
export class StoreManagementGuard implements CanActivate {
  constructor(private readonly context: StoreAdminContextService) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution
      .switchToHttp()
      .getRequest<{ user: StoreAdminUser; tenantId?: string }>();
    const context = await this.context.resolve(request.user);
    if (context.mode !== "MANAGE")
      throw new ForbiddenException(
        "La gestión de la tienda requiere una suscripción vigente",
      );
    request.tenantId = context.company.id;
    return true;
  }
}
