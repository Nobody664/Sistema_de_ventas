import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuditAction } from "@prisma/client";

import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { PlatformAuditService } from "./platform-audit.service";
import { PlatformApiUsageService } from "./platform-api-usage.service";
import {
  CreateApiProviderDto,
  BillApiUsageDto,
  CreateApiUsageRecordDto,
  QueryApiUsageDto,
  QueryApiUsageRecordsDto,
  UpdateApiProviderDto,
} from "./dto/platform-api-usage.dto";

@Controller("platform/api-usage")
@Roles("SUPER_ADMIN", "SUPPORT_ADMIN")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
export class PlatformApiUsageController {
  constructor(
    private readonly apiUsage: PlatformApiUsageService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Get("summary")
  getSummary(@Query() query: QueryApiUsageDto) {
    return this.apiUsage.getSummary(query);
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_FINANCE_MANAGE)
  @Post("records/bill")
  async billRecords(
    @Body() body: BillApiUsageDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.apiUsage.billRecords(body, user.sub);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "PlatformTransaction",
      entityId: result.id,
      changes: { apiUsageRecordIds: body.recordIds, amount: result.amount },
    });
    return result;
  }

  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Get("records")
  listRecords(@Query() query: QueryApiUsageRecordsDto) {
    return this.apiUsage.listRecords(query);
  }

  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Get("providers")
  listProviders() {
    return this.apiUsage.listProviders();
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Post("providers")
  async createProvider(
    @Body() body: CreateApiProviderDto,
    @CurrentUser() user: AuthUser,
  ) {
    const provider = await this.apiUsage.createProvider(body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "ApiProvider",
      entityId: provider.id,
      changes: { slug: provider.slug, name: provider.name },
    });
    return provider;
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Patch("providers/:id")
  async updateProvider(
    @Param("id") id: string,
    @Body() body: UpdateApiProviderDto,
    @CurrentUser() user: AuthUser,
  ) {
    const provider = await this.apiUsage.updateProvider(id, body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "ApiProvider",
      entityId: id,
      changes: { ...body },
    });
    return provider;
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Delete("providers/:id")
  async deleteProvider(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const result = await this.apiUsage.deleteProvider(id);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.DELETE,
      entity: "ApiProvider",
      entityId: id,
    });
    return result;
  }

  @Roles("SUPER_ADMIN")
  @Permissions(Permission.PLATFORM_API_USAGE_VIEW)
  @Post("records")
  async createRecord(
    @Body() body: CreateApiUsageRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    const record = await this.apiUsage.createRecord(body);
    await this.platformAudit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "ApiUsageRecord",
      entityId: record.id,
      changes: {
        companyId: record.companyId,
        tokens: record.tokens,
        cost: record.cost,
      },
    });
    return record;
  }
}
