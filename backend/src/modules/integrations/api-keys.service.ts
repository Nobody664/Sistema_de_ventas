import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Prisma } from "@prisma/client";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { PrismaService } from "@/database/prisma/prisma.service";
import { ApiQuotaService } from "@/modules/plan-capabilities/api-quota.service";
import { IntegrationOwnerService } from "./integration-owner.service";
import { CreateApiKeyDto } from "./dto/api-key.dto";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";

const metadata = {
  id: true,
  name: true,
  scopes: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
} satisfies Prisma.CompanyApiKeySelect;

export const hashApiKey = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: IntegrationOwnerService,
    private readonly quota: ApiQuotaService,
  ) {}

  async list(user: AuthUser) {
    const { companyId } = await this.owners.require(user);
    return this.prisma.companyApiKey.findMany({
      where: { companyId },
      select: metadata,
      orderBy: [
        { revokedAt: { sort: "asc", nulls: "first" } },
        { expiresAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 100,
    });
  }

  async create(user: AuthUser, input: CreateApiKeyDto) {
    const owner = await this.owners.require(user);
    await this.quota.assertAccess(owner.companyId);
    const id = randomUUID();
    const key = `vsk_${id}.${randomBytes(32).toString("base64url")}`;
    const result = await serializableTransaction(this.prisma, async (tx) => {
      if (
        (await tx.companyApiKey.count({
          where: {
            companyId: owner.companyId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        })) >= 10
      )
        throw new ConflictException("El negocio ya tiene diez claves activas");
      const created = await tx.companyApiKey.create({
        data: {
          id,
          companyId: owner.companyId,
          membershipId: owner.membershipId,
          name: input.name.trim(),
          keyHash: hashApiKey(key),
          scopes: input.scopes,
          expiresAt: new Date(
            Date.now() + (input.expiresInDays ?? 90) * 86400000,
          ),
        },
        select: metadata,
      });
      await tx.auditLog.create({
        data: {
          companyId: owner.companyId,
          userId: owner.userId,
          action: "CREATE",
          entity: "CompanyApiKey",
          entityId: id,
          changes: { scopes: input.scopes },
        },
      });
      return created;
    });
    return { ...result, key };
  }

  async revoke(user: AuthUser, id: string) {
    const owner = await this.owners.require(user);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.companyApiKey.findFirst({
        where: { id, companyId: owner.companyId },
        select: metadata,
      });
      if (!existing) throw new NotFoundException("Clave no encontrada");
      if (existing.revokedAt) return existing;
      const result = await tx.companyApiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
        select: metadata,
      });
      await tx.auditLog.create({
        data: {
          companyId: owner.companyId,
          userId: owner.userId,
          action: "UPDATE",
          entity: "CompanyApiKey",
          entityId: id,
          changes: { revoked: true },
        },
      });
      return result;
    });
  }

  async authenticate(value: string | undefined, scope: string) {
    if (!value || !/^vsk_[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(value))
      throw new UnauthorizedException("API Key inválida");
    const id = value.slice(4).split(".")[0];
    const key = await this.prisma.companyApiKey.findUnique({
      where: { id },
      include: {
        company: { select: { status: true } },
        membership: {
          select: {
            companyId: true,
            isActive: true,
            role: true,
            user: { select: { isActive: true } },
          },
        },
      },
    });
    if (
      !key ||
      !/^[a-f0-9]{64}$/.test(key.keyHash) ||
      key.revokedAt ||
      key.expiresAt <= new Date() ||
      !timingSafeEqual(
        Buffer.from(key.keyHash, "hex"),
        Buffer.from(hashApiKey(value), "hex"),
      )
    )
      throw new UnauthorizedException("API Key inválida o vencida");
    if (
      key.membership.companyId !== key.companyId ||
      !key.membership.isActive ||
      key.membership.role !== "COMPANY_ADMIN" ||
      !key.membership.user.isActive ||
      !["ACTIVE", "TRIAL"].includes(key.company.status)
    )
      throw new ForbiddenException(
        "La empresa o la membresía de esta clave no están activas",
      );
    if (!key.scopes.includes(scope))
      throw new ForbiddenException(
        "La clave no tiene el permiso de lectura requerido",
      );
    await this.quota.consume(key.companyId);
    const touched = await this.prisma.companyApiKey.updateMany({
      where: { id, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
    if (touched.count !== 1)
      throw new UnauthorizedException("API Key revocada");
    return { companyId: key.companyId, keyId: id };
  }
}
