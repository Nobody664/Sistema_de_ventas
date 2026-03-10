import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@UseGuards(TenantGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get()
  findByCompany(@Req() request: { tenantId: string }) {
    return this.productsService.findByCompany(request.tenantId);
  }

  @Roles('COMPANY_ADMIN', 'MANAGER', 'CASHIER')
  @Get('categories')
  findCategories(@Req() request: { tenantId: string }) {
    return this.productsService.findCategories(request.tenantId);
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
}
