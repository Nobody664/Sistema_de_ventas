import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { Permission } from "@/common/constants/permissions.constant";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { StoreCloseoutGuard } from "../store-closeout.guard";
import { StorePrivateInterceptor } from "../store-private.interceptor";
import { StoreAdminDashboardQueryDto } from "./dto/store-admin.dto";
import { StoreAdminContextService } from "./store-admin-context.service";
import { StoreAdminDashboardService } from "./store-admin-dashboard.service";

type StaffRequest = Request & {
  tenantId: string;
  user: { sub: string; companyId?: string | null; roles?: string[] };
};

@Roles("COMPANY_ADMIN")
@UseInterceptors(StorePrivateInterceptor)
@UseGuards(StoreCloseoutGuard, PermissionsGuard)
@Permissions(Permission.STORE_MANAGE)
@Controller("store-admin")
export class StoreAdminWorkspaceController {
  constructor(
    private readonly context: StoreAdminContextService,
    private readonly dashboard: StoreAdminDashboardService,
  ) {}

  @Get("context")
  resolveContext(@Req() req: StaffRequest) {
    return this.context.resolve(req.user);
  }

  @Get("dashboard")
  async getDashboard(
    @Req() req: StaffRequest,
    @Query() query: StoreAdminDashboardQueryDto,
  ) {
    const context = await this.context.resolve(req.user);
    if (!context.capabilities.viewDashboard)
      throw new ForbiddenException(
        "El panel no está disponible en modo de atención restringida",
      );
    return this.dashboard.get(context, query);
  }
}
