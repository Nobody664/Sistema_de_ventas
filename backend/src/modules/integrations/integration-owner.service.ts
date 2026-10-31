import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/database/prisma/prisma.service";

@Injectable()
export class IntegrationOwnerService {
  constructor(private readonly prisma: PrismaService) {}

  async require(user: AuthUser) {
    if (
      !user.companyId ||
      !user.roles.includes("COMPANY_ADMIN") ||
      user.roles.some((role) => ["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(role))
    )
      throw new ForbiddenException("Se requiere un administrador del negocio");
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: { userId: user.sub, companyId: user.companyId },
      },
      select: { id: true, isActive: true, role: true },
    });
    if (!membership?.isActive || membership.role !== "COMPANY_ADMIN")
      throw new ForbiddenException(
        "La membresía administradora no está activa",
      );
    return {
      companyId: user.companyId,
      membershipId: membership.id,
      userId: user.sub,
    };
  }
}
