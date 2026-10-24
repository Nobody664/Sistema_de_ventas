import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface SalesActor {
  userId: string;
  roles: readonly string[];
}

export function canReadCompanySales(actor: SalesActor): boolean {
  if (!actor?.userId || !Array.isArray(actor.roles)) throw new ForbiddenException("Se requiere un actor válido para consultar ventas");
  return actor.roles.some((role) => ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(role));
}

export function salesVisibility(companyId: string, actor: SalesActor): Prisma.SaleWhereInput {
  if (!companyId) throw new ForbiddenException("Se requiere una empresa para consultar ventas");
  return { companyId, ...(canReadCompanySales(actor) ? {} : { sellerId: actor.userId }) };
}

export function salesAudienceKey(actor: SalesActor): string {
  return canReadCompanySales(actor) ? "company" : `seller:${actor.userId}`;
}
