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
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { RequireModule } from "@/modules/plan-capabilities/decorators/require-module.decorator";
import { DistributorsService } from "./distributors.service";
import {
  CreateDistributorDeliveryDto,
  CreateDistributorDto,
  MoveDistributorStockDto,
  QueryDistributorsDto,
  RegisterDistributorSaleDto,
  SettleDistributorDto,
  UpdateDistributorDto,
  ReconcileDistributorStockDto,
} from "./dto/distributor.dto";

type TenantRequest = { tenantId: string };

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequireModule("distributors")
@Controller("distributors")
export class DistributorsController {
  constructor(private readonly distributorsService: DistributorsService) {}

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_TRANSFER)
  @Post(":id/reconcile-stock")
  reconcileStock(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: ReconcileDistributorStockDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.distributorsService.reconcileStock(
      request.tenantId,
      id,
      body,
      user.sub,
    );
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_LIST)
  @Get()
  findAll(@Req() request: TenantRequest, @Query() query: QueryDistributorsDto) {
    return this.distributorsService.findAll(request.tenantId, query);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_CREATE)
  @Post()
  create(@Req() request: TenantRequest, @Body() body: CreateDistributorDto) {
    return this.distributorsService.create(request.tenantId, body);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_VIEW)
  @Get(":id")
  findOne(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.distributorsService.findOne(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_UPDATE)
  @Patch(":id")
  update(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: UpdateDistributorDto,
  ) {
    return this.distributorsService.update(request.tenantId, id, body);
  }

  @Roles("COMPANY_ADMIN")
  @Permissions(Permission.DISTRIBUTOR_DELETE)
  @Delete(":id")
  remove(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.distributorsService.remove(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_VIEW)
  @Get(":id/balance")
  balance(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.distributorsService.getBalance(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_TRANSFER)
  @Post(":id/transfers")
  transfer(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: MoveDistributorStockDto,
  ) {
    return this.distributorsService.transfer(request.tenantId, id, body);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_TRANSFER)
  @Post(":id/returns")
  returnGoods(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: MoveDistributorStockDto,
  ) {
    return this.distributorsService.returnGoods(request.tenantId, id, body);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_VIEW)
  @Get(":id/sales")
  sales(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.distributorsService.findSales(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_DELIVERY)
  @Post(":id/sales")
  registerSale(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: RegisterDistributorSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.distributorsService.registerSale(request.tenantId, id, body, {
      userId: user.sub,
      roles: user.roles,
    });
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_DELIVERY)
  @Get(":id/deliveries")
  deliveries(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.distributorsService.findDeliveries(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.DISTRIBUTOR_DELIVERY)
  @Post(":id/deliveries")
  createDelivery(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: CreateDistributorDeliveryDto,
  ) {
    return this.distributorsService.createDelivery(request.tenantId, id, body);
  }

  @Roles("COMPANY_ADMIN")
  @Permissions(Permission.DISTRIBUTOR_SETTLE)
  @Post(":id/settlements")
  settle(
    @Req() request: TenantRequest,
    @Param("id") id: string,
    @Body() body: SettleDistributorDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.distributorsService.settle(
      request.tenantId,
      id,
      body,
      user.sub,
    );
  }
}
