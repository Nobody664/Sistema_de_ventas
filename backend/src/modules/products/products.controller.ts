import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Permission } from '@/common/constants/permissions.constant';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UploadProductImageDto,
  ExportProductsQueryDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.PRODUCT_EXPORT)
  @Get('export')
  exportProducts(
    @Req() request: { tenantId: string },
    @Query() query: ExportProductsQueryDto,
  ) {
    return this.productsService.exportProducts(request.tenantId, query);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.PRODUCT_VIEW_LOW_STOCK)
  @Get('low-stock')
  getLowStockProducts(@Req() request: { tenantId: string }) {
    return this.productsService.getLowStockProducts(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.PRODUCT_LIST)
  @Get('limits')
  getLimits(@Req() request: { tenantId: string }) {
    return this.productsService.getLimitsInfo(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.CATEGORY_LIST)
  @Get('categories')
  findCategories(@Req() request: { tenantId: string }) {
    return this.productsService.findCategories(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.CATEGORY_LIST)
  @Get('categories/:id')
  findCategoryById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.findCategoryById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.CATEGORY_CREATE)
  @Post('categories')
  createCategory(@Req() request: { tenantId: string }, @Body() body: CreateCategoryDto) {
    return this.productsService.createCategory(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.CATEGORY_UPDATE)
  @Patch('categories/:id')
  updateCategory(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.CATEGORY_DELETE)
  @Delete('categories/:id')
  removeCategory(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.removeCategory(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.PRODUCT_LIST)
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.productsService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Permissions(Permission.PRODUCT_LIST)
  @Get(':id')
  findProductById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.findProductById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.PRODUCT_CREATE)
  @Post()
  createProduct(@Req() request: { tenantId: string }, @Body() body: CreateProductDto) {
    return this.productsService.createProduct(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.PRODUCT_UPDATE)
  @Patch(':id')
  updateProduct(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Permissions(Permission.PRODUCT_DELETE)
  @Delete(':id')
  removeProduct(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.removeProduct(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Permissions(Permission.PRODUCT_UPDATE)
  @Post(':id/image')
  uploadImage(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UploadProductImageDto,
  ) {
    return this.productsService.uploadProductImage(request.tenantId, id, body.imageBase64);
  }
}
