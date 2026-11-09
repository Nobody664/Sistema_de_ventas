import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { StorePrivateInterceptor } from "../store-private.interceptor";
import { StoreIdentifierPipe } from "../store-identifier.pipe";
import { StoreManagementGuard } from "./store-management.guard";
import { StoreAdminManagementService } from "./store-admin-management.service";
import {
  StoreAdminAccountsQueryDto,
  StoreAdminCatalogQueryDto,
} from "./dto/store-admin.dto";

@Roles("COMPANY_ADMIN")
@Permissions(Permission.STORE_MANAGE)
@UseGuards(StoreManagementGuard, PermissionsGuard)
@UseInterceptors(StorePrivateInterceptor)
@Controller("store-admin")
export class StoreAdminManagementController {
  constructor(private readonly management: StoreAdminManagementService) {}
  @Get("catalog") catalog(
    @Req() req: { tenantId: string },
    @Query() query: StoreAdminCatalogQueryDto,
  ) {
    return this.management.catalog(req.tenantId, query);
  }
  @Get("accounts") accounts(
    @Req() req: { tenantId: string },
    @Query() query: StoreAdminAccountsQueryDto,
  ) {
    return this.management.accounts(req.tenantId, query);
  }
  @Get("accounts/:id") account(
    @Req() req: { tenantId: string },
    @Param("id", StoreIdentifierPipe) id: string,
  ) {
    return this.management.account(req.tenantId, id);
  }
}
