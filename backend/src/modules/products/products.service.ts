import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  UpdateCategoryDto,
  UpdateProductDto,
  ExportProductsQueryDto,
} from './dto/product.dto';
import { SubscriptionLimitService } from '@/common/guards/subscription-limit.service';
import { NotificationsService, NotificationType } from '@/modules/notifications/notifications.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitService: SubscriptionLimitService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getLimitsInfo(companyId: string) {
    return this.limitService.getAllLimitsInfo(companyId);
  }

  findProductById(companyId: string, id: string) {
    return this.prisma.product.findFirst({
      where: { id, companyId },
      include: { category: true },
    });
  }

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

  findCategoryById(companyId: string, id: string) {
    return this.prisma.category.findFirst({
      where: { id, companyId },
    });
  }

  async createCategory(companyId: string, input: CreateCategoryDto) {
    await this.limitService.validateLimit(companyId, 'categories');

    const slug = input.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        companyId,
        slug,
      },
    });

    if (existingCategory) {
      throw new ConflictException(`Ya existe una categoría con el nombre "${input.name}".`);
    }

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
    
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id, companyId },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría porque tiene ${productsCount} producto(s) asociado(s). Primero debes eliminar o reasignar los productos.`
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  async createProduct(companyId: string, input: CreateProductDto) {
    await this.limitService.validateLimit(companyId, 'products');

    // Get category for SKU generation
    let categoryCode: string | undefined;
    if (input.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: input.categoryId },
      });
      categoryCode = category?.name;
    }

    // Auto-generate SKU if not provided
    const sku = input.sku ?? this.generateSku(input.name, categoryCode);
    
    // Auto-generate barcode if not provided
    const barcode = input.barcode ?? this.generateBarcode();

    const product = await this.prisma.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        sku,
        barcode,
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl,
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        stockQuantity: input.stockQuantity ?? 0,
        minStock: input.minStock ?? 5,
      },
    });

    if (product.stockQuantity <= product.minStock) {
      await this.sendLowStockNotification(companyId, product);
    }

    return product;
  }

  async updateProduct(companyId: string, id: string, input: UpdateProductDto) {
    const existing = await this.ensureProduct(companyId, id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...input,
        categoryId: input.categoryId ?? undefined,
      },
    });

    if (
      input.stockQuantity !== undefined &&
      product.stockQuantity <= product.minStock &&
      existing.stockQuantity > existing.minStock
    ) {
      await this.sendLowStockNotification(companyId, product);
    }

    return product;
  }

  private async sendLowStockNotification(companyId: string, product: { id: string; name: string; stockQuantity: number; minStock: number }) {
    const admins = await this.prisma.employee.findMany({
      where: { companyId, role: 'COMPANY_ADMIN', isActive: true },
      select: { userId: true },
    });

    for (const admin of admins) {
      if (admin.userId) {
        await this.notificationsService.create({
          userId: admin.userId,
          companyId,
          type: NotificationType.LOW_STOCK,
          title: 'Stock bajo',
          message: `El producto "${product.name}" tiene solo ${product.stockQuantity} unidades (min: ${product.minStock})`,
          data: { productId: product.id, stockQuantity: product.stockQuantity },
        });
      }
    }
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

  private generateSku(name: string, categoryName?: string) {
    let prefix = 'PRD';
    if (categoryName) {
      const normalized = categoryName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .trim()
        .slice(0, 3);
      prefix = normalized || 'PRD';
    }
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}-${random}`;
  }

  private generateBarcode(): string {
    // Generate EAN-13 compatible barcode
    // Format: 7700 + 8 digits + check digit
    const prefix = '7700';
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
    const base = prefix + randomDigits;
    const checkDigit = this.calculateEan13CheckDigit(base);
    return base + checkDigit;
  }

  private calculateEan13CheckDigit(base: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  async getLowStockProducts(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
      },
      include: { category: true },
      orderBy: { stockQuantity: 'asc' },
    });

    return products.filter((p) => p.stockQuantity <= p.minStock);
  }

  async uploadProductImage(companyId: string, productId: string, imageBase64: string) {
    await this.ensureProduct(companyId, productId);

    return this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl: imageBase64 },
    });
  }

  async exportProducts(companyId: string, query: ExportProductsQueryDto) {
    const where: Record<string, unknown> = { companyId };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const format = query.format || 'csv';

    if (format === 'csv') {
      return this.generateCsvExport(products);
    } else if (format === 'excel') {
      return this.generateExcelExport(products);
    } else {
      return this.generatePdfExport(products);
    }
  }

  private generateCsvExport(products: Array<{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string } | null; costPrice: unknown; salePrice: unknown; stockQuantity: number; minStock: number }>) {
    const headers = ['Nombre', 'SKU', 'Codigo de Barras', 'Categoria', 'Precio Costo', 'Precio Venta', 'Stock', 'Stock Minimo'];
    const rows = products.map((p) => [
      p.name,
      p.sku,
      p.barcode || '',
      p.category?.name || '',
      String(p.costPrice),
      String(p.salePrice),
      String(p.stockQuantity),
      String(p.minStock),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    return {
      filename: `productos_${new Date().toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv',
      data: base64,
    };
  }

  private generateExcelExport(products: Array<{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string } | null; costPrice: unknown; salePrice: unknown; stockQuantity: number; minStock: number }>) {
    const data = products.map((p) => ({
      Nombre: p.name,
      SKU: p.sku,
      'Codigo de Barras': p.barcode || '',
      Categoria: p.category?.name || '',
      'Precio Costo': Number(p.costPrice),
      'Precio Venta': Number(p.salePrice),
      Stock: p.stockQuantity,
      'Stock Minimo': p.minStock,
    }));

    const jsonStr = JSON.stringify(data);
    const base64 = Buffer.from(jsonStr, 'utf-8').toString('base64');

    return {
      filename: `productos_${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json',
      data: base64,
    };
  }

  private generatePdfExport(products: Array<{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string } | null; costPrice: unknown; salePrice: unknown; stockQuantity: number; minStock: number }>) {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Reporte de Productos</h1>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>SKU</th>
                <th>Categoria</th>
                <th>Precio</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              ${products.map((p) => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.sku}</td>
                  <td>${p.category?.name || ''}</td>
                  <td>S/ ${Number(p.salePrice).toFixed(2)}</td>
                  <td>${p.stockQuantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const base64 = Buffer.from(html, 'utf-8').toString('base64');

    return {
      filename: `productos_${new Date().toISOString().split('T')[0]}.html`,
      contentType: 'text/html',
      data: base64,
    };
  }
}
