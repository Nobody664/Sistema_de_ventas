import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import {
  CreateFinanceRecordDto,
  QueryFinanceRecordDto,
  UpdateFinanceRecordDto,
} from "./dto/finance.dto";
import { FinanceService } from "./finance.service";

@Controller("finance")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Roles("COMPANY_ADMIN")
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Permissions(Permission.FINANCE_LIST)
  @Get()
  findAll(
    @Req() request: { tenantId: string },
    @Query() query: QueryFinanceRecordDto,
  ) {
    return this.financeService.findAll(request.tenantId, query);
  }

  @Permissions(Permission.FINANCE_LIST)
  @Get("summary")
  getSummary(
    @Req() request: { tenantId: string },
    @Query() query: QueryFinanceRecordDto,
  ) {
    return this.financeService.getSummary(request.tenantId, query);
  }

  @Permissions(Permission.FINANCE_LIST)
  @Get(":id")
  findOne(@Req() request: { tenantId: string }, @Param("id") id: string) {
    return this.financeService.findOne(request.tenantId, id);
  }

  @Permissions(Permission.FINANCE_MANAGE)
  @Post()
  create(
    @Req() request: { tenantId: string },
    @CurrentUser() user: AuthUser,
    @Body() body: CreateFinanceRecordDto,
  ) {
    return this.financeService.create(request.tenantId, user?.sub, body);
  }

  @Permissions(Permission.FINANCE_MANAGE)
  @Patch(":id")
  update(
    @Req() request: { tenantId: string },
    @Param("id") id: string,
    @Body() body: UpdateFinanceRecordDto,
  ) {
    return this.financeService.update(request.tenantId, id, body);
  }

  @Permissions(Permission.FINANCE_MANAGE)
  @Delete(":id")
  remove(@Req() request: { tenantId: string }, @Param("id") id: string) {
    return this.financeService.remove(request.tenantId, id);
  }
}
