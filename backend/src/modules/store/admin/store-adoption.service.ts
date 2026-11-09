import {
  Injectable,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "@/common/services/audit.service";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { StoreStudioService } from "../studio/studio.service";
import { StoreAdminUser } from "./store-admin-context.service";
import { storeExperiencePolicy } from "./store-adoption.policy";
import {
  StoreExperienceDto,
  StoreFormEventDto,
} from "./dto/store-adoption.dto";

@Injectable()
export class StoreAdoptionService {
  private readonly logger = new Logger(StoreAdoptionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly studio: StoreStudioService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}
  private policy(companyId: string, enabled: boolean) {
    return storeExperiencePolicy(
      companyId,
      enabled,
      this.config.get<string>("STORE_ADMIN_ROLLOUT") ?? "all",
      this.config.get<string>("STORE_ADMIN_PILOT_COMPANIES") ?? "",
    );
  }
  async event(user: StoreAdminUser, input: StoreFormEventDto) {
    const actor = await this.studio.actor(user);
    if (this.config.get<string>("STORE_ADMIN_TELEMETRY") !== "true")
      return { accepted: false };
    this.logger.log(
      JSON.stringify({
        event: "store_admin_form",
        companyId: actor.companyId,
        form: input.form,
        action: input.event,
        elapsedMs: input.elapsedMs,
      }),
    );
    return { accepted: true };
  }
  async get(user: StoreAdminUser) {
    const actor = await this.studio.actor(user);
    const row = await this.prisma.storeAdminFeatures.findUnique({
      where: { companyId: actor.companyId },
    });
    return {
      ...this.policy(actor.companyId, row?.experienceEnabled ?? true),
      version: row?.experienceVersion ?? 0,
    };
  }
  async update(user: StoreAdminUser, input: StoreExperienceDto) {
    const actor = await this.studio.actor(user);
    if (input.enabled && !this.policy(actor.companyId, true).eligible)
      throw new ForbiddenException(
        "La empresa no está incluida en la activación del despliegue",
      );
    return serializableTransaction(this.prisma, async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id = ${actor.companyId} FOR UPDATE`;
      const company = await tx.company.findUnique({
        where: { id: actor.companyId },
        select: { status: true },
      });
      const membership = await tx.membership.findFirst({
        where: {
          id: actor.membershipId,
          companyId: actor.companyId,
          userId: actor.userId,
          isActive: true,
          role: "COMPANY_ADMIN",
        },
        select: { id: true },
      });
      if (
        !membership ||
        !company ||
        !["ACTIVE", "TRIAL"].includes(company.status)
      )
        throw new ForbiddenException();
      const current = await tx.storeAdminFeatures.findUnique({
        where: { companyId: actor.companyId },
      });
      if ((current?.experienceVersion ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          "La experiencia cambió. Recarga antes de guardar.",
        );
      const row = await tx.storeAdminFeatures.upsert({
        where: { companyId: actor.companyId },
        create: {
          companyId: actor.companyId,
          experienceEnabled: input.enabled,
        },
        update: {
          experienceEnabled: input.enabled,
          experienceVersion: { increment: 1 },
        },
      });
      await this.audit.log(
        {
          companyId: actor.companyId,
          userId: actor.userId,
          action: "UPDATE",
          entity: "StoreAdminExperience",
          entityId: actor.companyId,
          changes: { enabled: input.enabled, version: row.experienceVersion },
        },
        tx,
      );
      return {
        ...this.policy(actor.companyId, row.experienceEnabled),
        version: row.experienceVersion,
      };
    });
  }
}
