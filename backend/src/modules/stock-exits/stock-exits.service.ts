import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { DistributorsService } from "@/modules/distributors/distributors.service";
import { AuditAction } from "@prisma/client";
import { CreateStockExitDto } from "./dto/stock-exit.dto";

@Injectable()
export class StockExitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly distributorsService: DistributorsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    companyId: string,
    userId: string | null,
    dto: CreateStockExitDto,
  ) {
    const distributor = await this.prisma.distributor.findFirst({
      where: { id: dto.distributorId, companyId, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    if (!distributor) {
      throw new NotFoundException("Distribuidor no encontrado.");
    }

    const result = await this.distributorsService.transfer(
      companyId,
      dto.distributorId,
      {
        items: dto.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        notes: dto.notes,
      },
    );

    await this.auditService.log({
      companyId,
      userId: userId ?? undefined,
      action: AuditAction.CREATE,
      entity: "StockExit",
      entityId: dto.distributorId,
      changes: {
        distributorId: dto.distributorId,
        items: dto.items,
        transferredQuantity: result.transferredQuantity,
      },
    });

    return result;
  }

  async findAll(companyId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { companyId, type: "TRANSFER", distributorId: { not: null } },
      include: {
        product: {
          select: { id: true, name: true, sku: true, baseUnit: true },
        },
        distributor: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
