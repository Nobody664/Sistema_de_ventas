import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { StoreCatalogQuery, StoreSettingsDto } from "./dto/store.dto";
import { StoreStockService } from "./store-stock.service";

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanCapabilitiesService,
    private readonly stock: StoreStockService,
  ) {}
  async company(slug: string, commerce = true) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: { storefront: true },
    });
    if (!company) throw new NotFoundException("Tienda no encontrada");
    if (commerce) {
      const capabilities = await this.plans.getCapabilities(company.id);
      if (
        !company.storefront?.enabled ||
        !["ACTIVE", "TRIAL"].includes(company.status) ||
        !this.plans.hasModule(capabilities, "storefront")
      )
        throw new ForbiddenException(
          "La tienda no está disponible para nuevas operaciones",
        );
    }
    return company;
  }
  async info(slug: string) {
    const company = await this.company(slug);
    return {
      name: company.storefront?.title || company.name,
      slug: company.slug,
      description: company.storefront?.description,
      phone: company.phone,
      currency: company.currency,
      registrationEnabled: company.storefront?.registrationEnabled,
    };
  }
  async catalog(slug: string, query: StoreCatalogQuery, productId?: string) {
    const company = await this.company(slug);
    const where = {
      companyId: company.id,
      ...(productId ? { id: productId } : {}),
      storeVisible: true,
      isActive: true,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            name: {
              contains: query.search.trim(),
              mode: "insensitive" as const,
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          salePrice: true,
          baseUnit: true,
          stockQuantity: true,
          category: { select: { id: true, name: true } },
          presentations: {
            where: { isActive: true },
            select: { id: true, name: true, factor: true, price: true },
          },
        },
        orderBy: [{ storeSortOrder: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    const available = await this.stock.available(
      company.id,
      rows.map((row) => row.id),
    );
    return {
      data: rows.map(
        ({
          salePrice,
          stockQuantity: _stockQuantity,
          presentations,
          ...row
        }) => ({
          ...row,
          price: salePrice.toString(),
          currency: company.currency,
          availability: available.get(row.id)?.gt(0)
            ? "AVAILABLE"
            : "OUT_OF_STOCK",
          quantityStep: row.baseUnit === "UNIT" ? "1" : "0.001",
          presentations: presentations.map((p) => ({
            ...p,
            factor: p.factor.toString(),
            price: (p.price ?? salePrice.mul(p.factor)).toString(),
          })),
        }),
      ),
      total,
      page: query.page,
      totalPages: Math.ceil(total / query.limit),
    };
  }
  async detail(slug: string, id: string) {
    const result = await this.catalog(slug, { page: 1, limit: 1 }, id);
    if (!result.data[0]) throw new NotFoundException("Producto no publicado");
    return result.data[0];
  }
  async categories(slug: string) {
    const company = await this.company(slug);
    return this.prisma.category.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        products: {
          some: { storeVisible: true, isActive: true, deletedAt: null },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  async settings(companyId: string) {
    const [settings, company] = await Promise.all([
      this.prisma.storefrontSettings.upsert({
        where: { companyId },
        create: { companyId },
        update: {},
      }),
      this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { slug: true },
      }),
    ]);
    return { ...settings, slug: company.slug };
  }
  async updateSettings(companyId: string, input: StoreSettingsDto) {
    if (input.enabled) {
      const capabilities = await this.plans.getCapabilities(companyId);
      if (!this.plans.hasModule(capabilities, "storefront"))
        throw new ForbiddenException(
          "Se requiere una suscripción vigente con pago confirmado para habilitar la tienda",
        );
    }
    return this.prisma.storefrontSettings.upsert({
      where: { companyId },
      create: { companyId, ...input },
      update: { ...input, version: { increment: 1 } },
    });
  }
}
