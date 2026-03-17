import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UploadProductImageDto,
  ExportProductsQueryDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('export')
  exportProducts(
    @Req() request: { tenantId: string },
    @Query() query: ExportProductsQueryDto,
  ) {
    return this.productsService.exportProducts(request.tenantId, query);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('low-stock')
  getLowStockProducts(@Req() request: { tenantId: string }) {
    return this.productsService.getLowStockProducts(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('limits')
  getLimits(@Req() request: { tenantId: string }) {
    return this.productsService.getLimitsInfo(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('categories')
  findCategories(@Req() request: { tenantId: string }) {
    return this.productsService.findCategories(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Get('categories/:id')
  findCategoryById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.findCategoryById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Post('categories')
  createCategory(@Req() request: { tenantId: string }, @Body() body: CreateCategoryDto) {
    return this.productsService.createCategory(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Patch('categories/:id')
  updateCategory(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Delete('categories/:id')
  removeCategory(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.removeCategory(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.productsService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get(':id')
  findProductById(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.findProductById(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Post()
  createProduct(@Req() request: { tenantId: string }, @Body() body: CreateProductDto) {
    return this.productsService.createProduct(request.tenantId, body);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Patch(':id')
  updateProduct(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(request.tenantId, id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Delete(':id')
  removeProduct(@Req() request: { tenantId: string }, @Param('id') id: string) {
    return this.productsService.removeProduct(request.tenantId, id);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER')
  @Post(':id/image')
  uploadImage(
    @Req() request: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UploadProductImageDto,
  ) {
    return this.productsService.uploadProductImage(request.tenantId, id, body.imageBase64);
  }
}
