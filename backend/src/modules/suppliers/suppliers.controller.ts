import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { SuppliersService } from "./suppliers.service";
import {
  CreateSupplierDto,
  CreateSupplierOrderDto,
  QuerySupplierOrdersDto,
  QuerySuppliersDto,
  ReceiveSupplierOrderDto,
  SetSupplierProductsDto,
  UpdateSupplierDto,
  UpdateSupplierOrderStatusDto,
} from "./dto/supplier.dto";

type TenantRequest = { tenantId: string };

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_LIST)
  @Get()
  findAll(@Req() request: TenantRequest, @Query() query: QuerySuppliersDto) {
    return this.suppliersService.findAll(request.tenantId, query);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_LIST)
  @Get("orders")
  findOrders(
    @Req() request: TenantRequest,
    @Query() query: QuerySupplierOrdersDto,
  ) {
    return this.suppliersService.findOrders(request.tenantId, query);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_LIST)
  @Get("orders/:id")
  findOrder(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.suppliersService.findOrder(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_MANAGE)
  @Post("orders")
  createOrder(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateSupplierOrderDto,
  ) {
    return this.suppliersService.createOrder(request.tenantId, user.sub, body);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_MANAGE)
  @Patch("orders/:id/status")
  updateOrderStatus(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateSupplierOrderStatusDto,
  ) {
    return this.suppliersService.updateOrderStatus(
      request.tenantId,
      user.sub,
      id,
      body,
    );
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_MANAGE)
  @Post("orders/:id/receive")
  receiveOrder(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: ReceiveSupplierOrderDto,
  ) {
    return this.suppliersService.receiveOrder(
      request.tenantId,
      user.sub,
      id,
      body,
    );
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_MANAGE)
  @Get("auto-orders/preview")
  getAutoOrdersPreview(@Req() request: TenantRequest) {
    return this.suppliersService.getAutoOrdersPreview(request.tenantId);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_ORDER_MANAGE)
  @Post("auto-orders/generate")
  generateAutoOrders(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
  ) {
    return this.suppliersService.generateAutoOrders(request.tenantId, user.sub);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_CREATE)
  @Post()
  create(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateSupplierDto,
  ) {
    return this.suppliersService.create(request.tenantId, user.sub, body);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_VIEW)
  @Get(":id")
  findOne(@Req() request: TenantRequest, @Param("id") id: string) {
    return this.suppliersService.findOne(request.tenantId, id);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_UPDATE)
  @Patch(":id")
  update(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(request.tenantId, user.sub, id, body);
  }

  @Roles("COMPANY_ADMIN", "MANAGER")
  @Permissions(Permission.SUPPLIER_UPDATE)
  @Put(":id/products")
  setProducts(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: SetSupplierProductsDto,
  ) {
    return this.suppliersService.setProducts(
      request.tenantId,
      user.sub,
      id,
      body,
    );
  }

  @Roles("COMPANY_ADMIN")
  @Permissions(Permission.SUPPLIER_DELETE)
  @Delete(":id")
  remove(
    @Req() request: TenantRequest,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.suppliersService.remove(request.tenantId, user.sub, id);
  }
}
