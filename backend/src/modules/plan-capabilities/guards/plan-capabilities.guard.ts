import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "@/common/decorators/public.decorator";
import { PlanCapabilitiesService } from "../plan-capabilities.service";
import { REQUIRE_MODULE_KEY } from "../decorators/require-module.decorator";
import { REQUIRE_FEATURE_KEY } from "../decorators/require-feature.decorator";
import { REQUIRE_PLAN_KEY } from "../decorators/require-plan.decorator";

type RequestUser = {
  companyId?: string | null;
  roles?: string[];
};

const GLOBAL_ADMIN_ROLES = ["SUPER_ADMIN", "SUPPORT_ADMIN"];

@Injectable()
export class PlanCapabilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly planCapabilities: PlanCapabilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(
      REQUIRE_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredModules =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_MODULE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredFeatures =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_FEATURE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (
      !requiredPlan &&
      requiredModules.length === 0 &&
      requiredFeatures.length === 0
    ) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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

    const capabilities = await this.planCapabilities.getCapabilities(companyId);

    if (requiredPlan && capabilities.planCode !== requiredPlan) {
      throw new ForbiddenException({
        error: "PLAN_REQUIRED",
        message: `Esta función requiere el plan ${requiredPlan}.`,
        requiredPlan,
        currentPlan: capabilities.planCode,
        upgradeUrl: "/subscription",
      });
    }

    const missingModules = requiredModules.filter(
      (module) => !this.planCapabilities.hasModule(capabilities, module),
    );
    if (missingModules.length > 0) {
      throw new ForbiddenException({
        error: "MODULE_NOT_ENABLED",
        message: "El módulo solicitado no está incluido en tu plan actual.",
        modules: missingModules,
        currentPlan: capabilities.planCode,
        upgradeUrl: "/subscription",
      });
    }

    const missingFeatures = requiredFeatures.filter(
      (feature) => !this.planCapabilities.hasFeature(capabilities, feature),
    );
    if (missingFeatures.length > 0) {
      throw new ForbiddenException({
        error: "FEATURE_NOT_AVAILABLE",
        message: "La función solicitada no está incluida en tu plan actual.",
        features: missingFeatures,
        currentPlan: capabilities.planCode,
        upgradeUrl: "/subscription",
      });
    }

    return true;
  }
}
