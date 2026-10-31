import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import { EXPORT_BATCH_SIZE } from "@/common/helpers/export-batch.helper";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  exportCollections,
  getExportDefinition,
  validateExportDefinitions,
} from "./data-export.collections";
import { ExportPageDto } from "./dto/export-page.dto";

interface ExportDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    select: Record<string, true>;
    take: number;
    orderBy: { id: "asc" };
  }): Promise<Array<Record<string, unknown> & { id: string }>>;
}

@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {
    validateExportDefinitions();
  }

  private async authorize(user: AuthUser): Promise<string> {
    if (
      !user.companyId ||
      !user.roles.includes("COMPANY_ADMIN") ||
      user.roles.some((role) => ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role))
    )
      throw new ForbiddenException(
        "Solo el administrador del negocio puede exportar sus datos",
      );
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId: user.sub, companyId: user.companyId },
      },
      select: { isActive: true, role: true },
    });
    if (!membership?.isActive || membership.role !== "COMPANY_ADMIN")
      throw new ForbiddenException(
        "La membresía administradora no está activa",
      );
    return user.companyId;
  }

  async manifest(user: AuthUser) {
    const companyId = await this.authorize(user);
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        legalName: true,
        taxId: true,
        address: true,
        email: true,
        phone: true,
        currency: true,
        timezone: true,
        inventoryCostMethod: true,
        createdAt: true,
      },
    });
    return {
      format: "ventas.business-data",
      version: 1,
      startedAt: new Date().toISOString(),
      company,
      consistency: "live-read-with-creation-cutoff",
      decimalEncoding: "string",
      collections: [...Object.keys(exportCollections), "distributorStocks"],
      excluded: [
        "credentials",
        "sessions",
        "apiKeys",
        "webhookSecrets",
        "platformData",
        "supportConversations",
        "auditLogs",
        "subscriptionBilling",
      ],
    };
  }

  async page(user: AuthUser, collection: string, query: ExportPageDto) {
    const companyId = await this.authorize(user);
    const startedAt = new Date(query.startedAt);
    if (
      !Number.isFinite(startedAt.getTime()) ||
      startedAt.getTime() > Date.now() + 60000 ||
      startedAt.getTime() < Date.now() - 86400000
    )
      throw new BadRequestException(
        "La exportación venció. Inicia una nueva descarga",
      );
    if (collection === "distributorStocks") {
      const parts = query.after?.split(":");
      if (parts && parts.length !== 2)
        throw new BadRequestException("Cursor inválido");
      const rows = await this.prisma.distributorStock.findMany({
        where: {
          distributor: { companyId, createdAt: { lte: startedAt } },
          product: { companyId, createdAt: { lte: startedAt } },
          ...(parts
            ? {
                OR: [
                  { distributorId: { gt: parts[0] } },
                  { distributorId: parts[0], productId: { gt: parts[1] } },
                ],
              }
            : {}),
        },
        select: { distributorId: true, productId: true, quantity: true },
        orderBy: [{ distributorId: "asc" }, { productId: "asc" }],
        take: EXPORT_BATCH_SIZE + 1,
      });
      const page = rows.slice(0, EXPORT_BATCH_SIZE);
      const last = page.at(-1);
      return {
        collection,
        rows: page,
        nextCursor:
          rows.length > EXPORT_BATCH_SIZE && last
            ? `${last.distributorId}:${last.productId}`
            : null,
      };
    }
    const definition = getExportDefinition(collection);
    if (!definition)
      throw new BadRequestException("Colección de exportación desconocida");
    const delegateName =
      definition.model[0].toLowerCase() + definition.model.slice(1);
    const delegate = (this.prisma as unknown as Record<string, ExportDelegate>)[
      delegateName
    ];
    const scope = definition.parent
      ? { [definition.parent]: { companyId } }
      : { companyId };
    const rows = await delegate.findMany({
      where: {
        ...scope,
        createdAt: { lte: startedAt },
        ...(query.after ? { id: { gt: query.after } } : {}),
      },
      select: Object.fromEntries(
        definition.fields.map((field) => [field, true as const]),
      ),
      orderBy: { id: "asc" },
      take: EXPORT_BATCH_SIZE + 1,
    });
    const page = [];
    let bytes = 0;
    for (const row of rows.slice(0, EXPORT_BATCH_SIZE)) {
      const size = Buffer.byteLength(JSON.stringify(row));
      if (size > 1024 * 1024)
        throw new PayloadTooLargeException(
          "Un registro supera el límite de 1 MiB de exportación",
        );
      if (bytes + size > 1024 * 1024) break;
      bytes += size;
      page.push(row);
    }
    return {
      collection,
      rows: page,
      nextCursor: rows.length > page.length ? page.at(-1)!.id : null,
    };
  }
}
