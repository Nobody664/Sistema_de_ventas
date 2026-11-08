import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { BatchExpiryService } from "./batch-expiry.service";
import { BatchExpiryQueryDto, BatchWriteOffDto } from "./dto/batch-expiry.dto";

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Roles("COMPANY_ADMIN", "MANAGER")
@RequireModule("inventory")
@Controller("batch-expiry")
export class BatchExpiryController {
  constructor(private readonly expiry: BatchExpiryService) {}
  @Permissions(Permission.INVENTORY_VIEW)
  @Get()
  list(@Req() req: { tenantId: string }, @Query() query: BatchExpiryQueryDto) {
    return this.expiry.list(req.tenantId, query);
  }
  @Permissions(Permission.INVENTORY_ADJUST)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(":id/write-off")
  writeOff(
    @Req() req: { tenantId: string; user: { sub: string } },
    @Param("id") id: string,
    @Body() input: BatchWriteOffDto,
  ) {
    return this.expiry.writeOff(req.tenantId, id, input, req.user.sub);
  }
}
