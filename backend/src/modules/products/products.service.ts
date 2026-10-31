import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { validateExpiryPolicy } from "@/modules/expiry-alerts/expiry-policy";
import { PrismaService } from "@/database/prisma/prisma.service";
import { collectExportRows } from "@/common/helpers/export-batch.helper";
import {
  optionalDate,
  rejectNullFields,
} from "@/common/helpers/patch-contract.helper";
import {
  CreateCategoryDto,
  CreatePresentationDto,
  CreateProductDto,
  QueryProductDto,
  UpdateCategoryDto,
  UpdatePresentationDto,
  UpdateProductDto,
  ExportProductsQueryDto,
} from "./dto/product.dto";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { AuditService } from "@/common/services/audit.service";
import {
  parseImageDataUrl,
  parseImageSource,
} from "@/common/helpers/image.helper";
import {
  buildCsvExport,
  buildPdfExport,
  buildXlsxExport,
  ExportColumn,
} from "@/common/helpers/export.helper";

const PRODUCT_LIST_SELECT = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  baseUnit: true,
  salePrice: true,
  costPrice: true,
  stockQuantity: true,
  minStock: true,
  isActive: true,
  imageUrl: true,
  description: true,
  createdAt: true,
  expiryDate: true,
  expiryProfile: true,
  expiryWarningDays: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  presentations: {
    select: { id: true, name: true, factor: true, price: true },
  },
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly limitService: SubscriptionLimitService,
    private readonly lowStockService: LowStockService,
    private readonly auditService: AuditService,
  ) {}

  async getLimitsInfo(companyId: string) {
    return this.limitService.getAllLimitsInfo(companyId);
  }

  findProductById(companyId: string, id: string) {
    return this.prisma.product.findFirst({
      where: { id, companyId },
      include: {
        category: true,
        presentations: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  findByBarcode(companyId: string, barcode: string) {
    return this.prisma.product.findFirst({
      where: { companyId, barcode },
      include: { category: true },
    });
  }

  findByCompany(companyId: string, query?: QueryProductDto) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 50;

    return this.prisma.product.findMany({
      where: this.productListWhere(companyId, query),
      select: PRODUCT_LIST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findCatalog(companyId: string, query: QueryProductDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.productListWhere(companyId, query);
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private productListWhere(
    companyId: string,
    query?: QueryProductDto,
  ): Prisma.ProductWhereInput {
    const search = query?.search?.trim();
    return {
      companyId,
      deletedAt: null,
      ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query?.isActive ? { isActive: query.isActive === "true" } : {}),
      ...(search
        ? {
            OR: ["name", "sku", "barcode", "description"].map((field) => ({
              [field]: { contains: search, mode: "insensitive" },
            })),
          }
        : {}),
    };
  }

  findCategories(companyId: string) {
    return this.prisma.category.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  findCategoryById(companyId: string, id: string) {
    return this.prisma.category.findFirst({
      where: { id, companyId },
    });
  }

  async createCategory(companyId: string, input: CreateCategoryDto) {
    await this.limitService.validateLimit(companyId, "categories");

    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        companyId,
        slug,
      },
    });

    if (existingCategory) {
      throw new ConflictException(
        `Ya existe una categoría con el nombre "${input.name}".`,
      );
    }

    const category = await this.prisma.category.create({
      data: {
        companyId,
        name: input.name,
        description: input.description,
        slug,
      },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Category",
      entityId: category.id,
      changes: { name: category.name, slug: category.slug },
    });

    return category;
  }

  async updateCategory(
    companyId: string,
    id: string,
    input: UpdateCategoryDto,
  ) {
    const existing = await this.ensureCategory(companyId, id);
    const slug = input.name
      ? input.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
      : undefined;

    const category = await this.prisma.category.updateMany({
      where: { id, companyId },
      data: {
        ...input,
        ...(slug ? { slug } : {}),
      },
    });
    if (category.count === 0) {
      throw new NotFoundException("Category not found.");
    }

    const categoryRecord = await this.prisma.category.findFirst({
      where: { id, companyId },
    });
    if (!categoryRecord) {
      throw new NotFoundException("Category not found.");
    }

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "Category",
      entityId: categoryRecord.id,
      changes: {
        before: { name: existing.name, slug: existing.slug },
        after: input,
      },
    });

    return categoryRecord;
  }

  async removeCategory(companyId: string, id: string) {
    const existing = await this.ensureCategory(companyId, id);

    const productsCount = await this.prisma.product.count({
      where: { categoryId: id, companyId },
    });

    if (productsCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría porque tiene ${productsCount} producto(s) asociado(s). Primero debes eliminar o reasignar los productos.`,
      );
    }

    const category = await this.prisma.category.deleteMany({
      where: { id, companyId },
    });
    if (category.count === 0) {
      throw new NotFoundException("Category not found.");
    }

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "Category",
      entityId: id,
      changes: { name: existing.name, slug: existing.slug },
    });

    return existing;
  }

  async createProduct(companyId: string, input: CreateProductDto) {
    const expiryPolicy = validateExpiryPolicy(
      input.expiryProfile ?? "STANDARD",
      input.expiryWarningDays,
    );
    const expiryDate = optionalDate(input.expiryDate);
    await this.limitService.validateLimit(companyId, "products");

    let categoryCode: string | undefined;
    if (input.categoryId) {
      const category = await this.ensureCategory(companyId, input.categoryId);
      categoryCode = category.name;
    }

    const sku = input.sku ?? this.generateSku(input.name, categoryCode);

    const barcode = input.barcode ?? this.generateBarcode();

    const product = await this.prisma.product.create({
      data: {
        companyId,
        categoryId: input.categoryId,
        sku,
        barcode,
        name: input.name,
        description: input.description,
        imageUrl: await parseImageSource(input.imageUrl),
        baseUnit: input.baseUnit ?? "UNIT",
        costPrice: input.costPrice,
        salePrice: input.salePrice,
        stockQuantity: input.stockQuantity ?? 0,
        minStock: input.minStock ?? 5,
        expiryDate: expiryDate ?? null,
        ...expiryPolicy,
        ...(input.presentations && input.presentations.length > 0
          ? {
              presentations: {
                create: input.presentations.map((pres) => ({
                  companyId,
                  name: pres.name,
                  factor: pres.factor,
                  price: pres.price,
                  barcode: pres.barcode,
                  isActive: pres.isActive ?? true,
                })),
              },
            }
          : {}),
      },
      include: { presentations: true },
    });

    if (product.stockQuantity.lte(product.minStock)) {
      await this.lowStockService.notifyIfLowStock({
        companyId,
        productId: product.id,
        productName: product.name,
        currentStock: product.stockQuantity,
        minStock: product.minStock,
        baseUnit: product.baseUnit,
      });
    }

    if (product.expiryDate) {
      try {
        await this.lowStockService.notifyIfExpiring({
          companyId,
          productId: product.id,
          productName: product.name,
          expiryDate: product.expiryDate,
          baseUnit: product.baseUnit,
        });
      } catch {
        this.logger.warn(
          "La revisión de vigencia del producto se recuperará en el siguiente ciclo",
        );
      }
    }

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Product",
      entityId: product.id,
      changes: {
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        salePrice: Number(product.salePrice),
        costPrice:
          product.costPrice === null ? null : Number(product.costPrice),
        stockQuantity: Number(product.stockQuantity),
      },
    });

    return product;
  }

  async updateProduct(companyId: string, id: string, input: UpdateProductDto) {
    rejectNullFields(input, [
      "name",
      "baseUnit",
      "salePrice",
      "minStock",
      "isActive",
      "expiryProfile",
    ]);
    const expiryDate = optionalDate(input.expiryDate);
    const existing = await this.ensureProduct(companyId, id);
    const policyChanged =
      input.expiryProfile !== undefined ||
      input.expiryWarningDays !== undefined;
    const expiryPolicy = policyChanged
      ? validateExpiryPolicy(
          input.expiryProfile ?? existing.expiryProfile,
          input.expiryWarningDays !== undefined
            ? input.expiryWarningDays
            : input.expiryProfile && input.expiryProfile !== "CUSTOM"
              ? null
              : existing.expiryWarningDays,
        )
      : {};

    if (input.categoryId) {
      await this.ensureCategory(companyId, input.categoryId);
    }

    const product = await this.prisma.product.updateMany({
      where: { id, companyId },
      data: {
        ...input,
        imageUrl: await parseImageSource(input.imageUrl),
        categoryId: input.categoryId,
        isActive: input.isActive,
        deletedAt: input.isActive === true ? null : undefined,
        expiryDate,
        ...expiryPolicy,
      },
    });
    if (product.count === 0) {
      throw new NotFoundException("Product not found.");
    }

    const updatedProduct = await this.prisma.product.findFirst({
      where: { id, companyId },
    });
    if (!updatedProduct) {
      throw new NotFoundException("Product not found.");
    }

    if (input.minStock !== undefined) {
      await this.lowStockService.notifyIfLowStock({
        companyId,
        productId: updatedProduct.id,
        productName: updatedProduct.name,
        currentStock: updatedProduct.stockQuantity,
        minStock: updatedProduct.minStock,
        baseUnit: updatedProduct.baseUnit,
        previousStock: existing.stockQuantity,
        previousMinStock: existing.minStock,
      });
    }
    if (
      input.expiryDate !== undefined ||
      policyChanged ||
      input.isActive !== undefined
    ) {
      try {
        await this.lowStockService.notifyIfExpiring({
          companyId,
          productId: updatedProduct.id,
          productName: updatedProduct.name,
          expiryDate: updatedProduct.expiryDate,
          baseUnit: updatedProduct.baseUnit,
        });
      } catch {
        this.logger.warn(
          "La revisión de vigencia del producto se recuperará en el siguiente ciclo",
        );
      }
    }

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "Product",
      entityId: updatedProduct.id,
      changes: {
        before: {
          name: existing.name,
          sku: existing.sku,
          salePrice: Number(existing.salePrice),
          stockQuantity: existing.stockQuantity,
          isActive: existing.isActive,
        },
        after: input,
      },
    });

    return updatedProduct;
  }

  async removeProduct(companyId: string, id: string) {
    const existing = await this.ensureProduct(companyId, id);

    const [saleItemsCount, movementsCount, stockEntryItemsCount] =
      await Promise.all([
        this.prisma.saleItem.count({ where: { productId: id } }),
        this.prisma.inventoryMovement.count({ where: { productId: id } }),
        this.prisma.stockEntryItem.count({ where: { productId: id } }),
      ]);

    const hasHistory =
      saleItemsCount > 0 || movementsCount > 0 || stockEntryItemsCount > 0;

    if (hasHistory) {
      const productUpdate = await this.prisma.product.updateMany({
        where: { id, companyId },
        data: { deletedAt: new Date(), isActive: false },
      });
      if (productUpdate.count === 0) {
        throw new NotFoundException("Product not found.");
      }
      const product = await this.prisma.product.findFirst({
        where: { id, companyId },
      });
      if (!product) {
        throw new NotFoundException("Product not found.");
      }

      await this.auditService.log({
        companyId,
        action: AuditAction.DELETE,
        entity: "Product",
        entityId: id,
        changes: {
          softDelete: true,
          saleItemsCount,
          movementsCount,
          stockEntryItemsCount,
          name: existing.name,
        },
      });

      return product;
    }

    const product = await this.prisma.product.deleteMany({
      where: { id, companyId },
    });
    if (product.count === 0) {
      throw new NotFoundException("Product not found.");
    }

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "Product",
      entityId: id,
      changes: { softDelete: false, name: existing.name, sku: existing.sku },
    });

    return existing;
  }

  async listPresentations(companyId: string, productId: string) {
    await this.ensureProduct(companyId, productId);
    return this.prisma.productPresentation.findMany({
      where: { companyId, productId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createPresentation(
    companyId: string,
    productId: string,
    input: CreatePresentationDto,
  ) {
    rejectNullFields(input, ["name", "factor", "isActive"]);
    await this.ensureProduct(companyId, productId);

    if (input.barcode) {
      const existing = await this.prisma.productPresentation.findFirst({
        where: { companyId, barcode: input.barcode },
      });
      if (existing) {
        throw new ConflictException(
          "Ya existe una presentación con ese código de barras.",
        );
      }
    }

    return this.prisma.productPresentation.create({
      data: {
        companyId,
        productId,
        name: input.name,
        factor: input.factor,
        price: input.price,
        barcode: input.barcode,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updatePresentation(
    companyId: string,
    presentationId: string,
    input: UpdatePresentationDto,
  ) {
    rejectNullFields(input, ["name", "factor", "isActive"]);
    const presentation = await this.prisma.productPresentation.findFirst({
      where: { id: presentationId, companyId },
    });
    if (!presentation) {
      throw new NotFoundException("Presentation not found.");
    }

    if (input.barcode && input.barcode !== presentation.barcode) {
      const existing = await this.prisma.productPresentation.findFirst({
        where: { companyId, barcode: input.barcode },
      });
      if (existing) {
        throw new ConflictException(
          "Ya existe una presentación con ese código de barras.",
        );
      }
    }

    return this.prisma.productPresentation.update({
      where: { id: presentationId },
      data: {
        name: input.name,
        factor: input.factor,
        price: input.price,
        barcode: input.barcode,
        isActive: input.isActive,
      },
    });
  }

  async removePresentation(companyId: string, presentationId: string) {
    const presentation = await this.prisma.productPresentation.findFirst({
      where: { id: presentationId, companyId },
    });
    if (!presentation) {
      throw new NotFoundException("Presentation not found.");
    }

    await this.prisma.productPresentation.deleteMany({
      where: { id: presentationId, companyId },
    });
    return presentation;
  }

  private async ensureProduct(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return product;
  }

  private async ensureCategory(companyId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId },
    });

    if (!category) {
      throw new NotFoundException("Category not found.");
    }

    return category;
  }

  private generateSku(name: string, categoryName?: string) {
    let prefix = "PRD";
    if (categoryName) {
      const normalized = categoryName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .trim()
        .slice(0, 3);
      prefix = normalized || "PRD";
    }
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}-${random}`;
  }

  private generateBarcode(): string {
    const prefix = "7700";
    const randomDigits = Math.floor(
      10000000 + Math.random() * 90000000,
    ).toString();
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
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        minStock: true,
        category: { select: { name: true } },
      },
      orderBy: { stockQuantity: "asc" },
      take: 10000,
    });

    return products
      .filter((p) => p.stockQuantity.lte(p.minStock))
      .slice(0, 100);
  }

  async uploadProductImage(
    companyId: string,
    productId: string,
    imageBase64: string,
  ) {
    await this.ensureProduct(companyId, productId);

    const image = await parseImageDataUrl(imageBase64);

    return this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl: image.dataUrl },
    });
  }

  async exportProducts(companyId: string, query: ExportProductsQueryDto) {
    const where: Record<string, unknown> = { companyId };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const products = await collectExportRows((take, after) =>
      this.prisma.product.findMany({
        take,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        where,
        include: { category: true },
        orderBy: { id: "asc" },
      }),
    );

    const format = query.format || "csv";

    const columns: ExportColumn<ProductExportRow>[] = [
      { header: "Nombre", value: (p) => p.name, width: 4 },
      { header: "SKU", value: (p) => p.sku ?? "", width: 2 },
      { header: "Codigo de Barras", value: (p) => p.barcode ?? "", width: 3 },
      { header: "Categoria", value: (p) => p.category?.name ?? "", width: 2 },
      {
        header: "Precio Costo",
        value: (p) => Number(p.costPrice),
        pdfValue: (p) => `S/ ${Number(p.costPrice).toFixed(2)}`,
        width: 1.5,
      },
      {
        header: "Precio Venta",
        value: (p) => Number(p.salePrice),
        pdfValue: (p) => `S/ ${Number(p.salePrice).toFixed(2)}`,
        width: 1.5,
      },
      { header: "Stock", value: (p) => Number(p.stockQuantity), width: 1 },
      {
        header: "Stock Minimo",
        value: (p) => Number(p.minStock),
        width: 1.5,
      },
    ];

    if (format === "csv") {
      return buildCsvExport("productos", columns, products);
    }
    if (format === "excel") {
      return buildXlsxExport("productos", "Productos", columns, products);
    }
    return buildPdfExport(
      "productos",
      "Reporte de Productos",
      columns,
      products,
      `Total: ${products.length} producto(s)`,
    );
  }
}

type ProductExportRow = {
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category: { name: string } | null;
  costPrice: unknown;
  salePrice: unknown;
  stockQuantity: Prisma.Decimal;
  minStock: Prisma.Decimal;
};
