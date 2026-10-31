import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { DataExportService } from "./data-export.service";
import { ExportPageDto } from "./dto/export-page.dto";

@Controller("data-export")
@Roles("COMPANY_ADMIN")
@Permissions(Permission.COMPANY_UPDATE)
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard, PermissionsGuard)
export class DataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get("manifest")
  @Header("Cache-Control", "private, no-store")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  manifest(@CurrentUser() user: AuthUser) {
    return this.service.manifest(user);
  }

  @Get(":collection")
  @Header("Cache-Control", "private, no-store")
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  page(
    @CurrentUser() user: AuthUser,
    @Param("collection") collection: string,
    @Query() query: ExportPageDto,
  ) {
    return this.service.page(user, collection, query);
  }
}
