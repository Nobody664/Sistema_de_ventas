import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ApiQuotaService } from "../api-quota.service";

type RequestUser = {
  companyId?: string | null;
  roles?: string[];
};

const GLOBAL_ADMIN_ROLES = ["SUPER_ADMIN", "SUPPORT_ADMIN"];

@Injectable()
export class ApiQuotaGuard implements CanActivate {
  constructor(private readonly apiQuota: ApiQuotaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;

    if (!user) {
      return true;
    }

    if (user.roles?.some((role) => GLOBAL_ADMIN_ROLES.includes(role))) {
      return true;
    }

    const companyId = user.companyId;
    if (!companyId) {
      return true;
    }

    await this.apiQuota.consume(companyId);
    return true;
  }
}
