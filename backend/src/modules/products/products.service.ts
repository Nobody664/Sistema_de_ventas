import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findByCompany(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findCategories(companyId: string) {
    return this.prisma.category.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  createCategory(companyId: string, input: CreateCategoryDto) {
    const slug = input.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    return this.prisma.category.create({
      data: {
        companyId,
        name: input.name,
        description: input.description,
        slug,
      },
    });
  }

  async updateCategory(companyId: string, id: string, input: UpdateCategoryDto) {
    await this.ensureCategory(companyId, id);
    const slug = input.name
      ? input.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
      : undefined;

    return this.prisma.category.update({
      where: { id },
      data: {
        ...input,
        ...(slug ? { slug } : {}),
      },
    });
  }

  async removeCategory(companyId: string, id: string) {
    await this.ensureCategory(companyId, id);
    return this.prisma.category.delete({ where: { id } });
  }

  createProduct(companyId: string, input: CreateProductDto) {
    const sku = input.sku ?? this.generateSku(input.name);

    return this.prisma.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        sku,
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        stockQuantity: input.stockQuantity ?? 0,
        minStock: input.minStock ?? 5,
      },
    });
  }

  async updateProduct(companyId: string, id: string, input: UpdateProductDto) {
    await this.ensureProduct(companyId, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...input,
        categoryId: input.categoryId ?? undefined,
      },
    });
  }

  async removeProduct(companyId: string, id: string) {
    await this.ensureProduct(companyId, id);
    return this.prisma.product.delete({ where: { id } });
  }

  private async ensureProduct(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return product;
  }

  private async ensureCategory(companyId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return category;
  }

  private generateSku(name: string) {
    const normalized = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .map((chunk) => chunk.slice(0, 4))
      .join('-');

    return `${normalized || 'SKU'}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
