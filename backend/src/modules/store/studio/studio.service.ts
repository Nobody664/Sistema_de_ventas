import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { parseImageDataUrl } from "@/common/helpers/image.helper";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import {
  StoreAdminContextService,
  StoreAdminUser,
} from "../admin/store-admin-context.service";
import {
  appearanceSchema,
  AppearanceDefinition,
  defaultAppearance,
  parseAppearance,
  studioDefinition,
} from "./studio.schemas";
import {
  StudioDraftDto,
  StudioFeaturesDto,
  StudioMediaDto,
  StudioPublishDto,
  StudioViewDto,
  StudioViewUpdateDto,
} from "./studio.dto";

type Feature = "appearance" | "notes" | "savedViews";
export interface StudioActor {
  companyId: string;
  membershipId: string;
  userId: string;
}
const mediaSelect = {
  id: true,
  purpose: true,
  state: true,
  mimeType: true,
  byteSize: true,
  width: true,
  height: true,
  createdAt: true,
} satisfies Prisma.StoreMediaAssetSelect;

@Injectable()
export class StoreStudioService {
  private readonly logger = new Logger(StoreStudioService.name);
  private mediaCursor: string | undefined;
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: StoreAdminContextService,
    private readonly audit: AuditService,
  ) {}

  async actor(user: StoreAdminUser, feature?: Feature): Promise<StudioActor> {
    const context = await this.context.resolve(user);
    if (context.mode !== "MANAGE")
      throw new ForbiddenException(
        "Esta función requiere gestión completa de la tienda",
      );
    const membership = await this.prisma.membership.findFirst({
      where: {
        companyId: context.company.id,
        userId: user.sub,
        role: "COMPANY_ADMIN",
        isActive: true,
      },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException();
    if (feature && !(await this.features(context.company.id))[feature])
      throw new ForbiddenException(
        "Activa esta función desde la configuración de la tienda",
      );
    return {
      companyId: context.company.id,
      membershipId: membership.id,
      userId: user.sub,
    };
  }

  async features(companyId: string) {
    const row = await this.prisma.storeAdminFeatures.findUnique({
      where: { companyId },
    });
    return {
      appearance: row?.appearance ?? false,
      notes: row?.notes ?? false,
      savedViews: row?.savedViews ?? false,
      version: row?.version ?? 0,
    };
  }

  private async write<T>(
    actor: StudioActor,
    feature: Feature | undefined,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await serializableTransaction(this.prisma, async (tx) => {
        await tx.$queryRaw`SELECT id FROM companies WHERE id = ${actor.companyId} FOR UPDATE`;
        const company = await tx.company.findUnique({
          where: { id: actor.companyId },
          select: { status: true },
        });
        if (!company || !["ACTIVE", "TRIAL"].includes(company.status))
          throw new ForbiddenException(
            "La empresa ya no admite gestión de tienda",
          );
        if (
          !(await tx.membership.findFirst({
            where: {
              id: actor.membershipId,
              companyId: actor.companyId,
              userId: actor.userId,
              role: "COMPANY_ADMIN",
              isActive: true,
            },
            select: { id: true },
          }))
        )
          throw new ForbiddenException();
        if (
          feature &&
          !(
            await tx.storeAdminFeatures.findUnique({
              where: { companyId: actor.companyId },
            })
          )?.[feature]
        )
          throw new ForbiddenException("La función fue desactivada");
        return operation(tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException("Ya existe un registro con ese nombre");
      throw error;
    }
  }

  private log(
    tx: Prisma.TransactionClient,
    actor: StudioActor,
    entity: string,
    id: string,
    changes: unknown,
  ) {
    return this.audit.log(
      {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "UPDATE",
        entity,
        entityId: id,
        changes,
      },
      tx,
    );
  }

  private async notice(
    tx: Prisma.TransactionClient,
    actor: StudioActor,
    message: string,
    actionUrl: string,
  ) {
    const owners = await tx.membership.findMany({
      where: {
        companyId: actor.companyId,
        role: "COMPANY_ADMIN",
        isActive: true,
        user: { isActive: true },
      },
      select: { userId: true },
    });
    for (const owner of owners) {
      const notice = await tx.notification.create({
        data: {
          companyId: actor.companyId,
          userId: owner.userId,
          scope: "COMPANY",
          type: "SYSTEM",
          title: "Centro de tienda",
          message,
          actionUrl,
        },
      });
      await tx.outboxEvent.create({
        data: {
          kind: "STORE_ORDER_NOTIFICATION",
          aggregateId: notice.id,
          dedupeKey: `STORE_STUDIO:${notice.id}`,
        },
      });
    }
  }

  async configureFeatures(actor: StudioActor, input: StudioFeaturesDto) {
    return this.write(actor, undefined, async (tx) => {
      const current = await tx.storeAdminFeatures.findUnique({
        where: { companyId: actor.companyId },
      });
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          "La configuración cambió. Recarga antes de guardar.",
        );
      const values = {
        appearance: input.appearance,
        notes: input.notes,
        savedViews: input.savedViews,
      };
      const result = await tx.storeAdminFeatures.upsert({
        where: { companyId: actor.companyId },
        create: { companyId: actor.companyId, ...values },
        update: { ...values, version: { increment: 1 } },
      });
      await this.log(tx, actor, "StoreAdminFeatures", actor.companyId, values);
      return result;
    });
  }

  private ensureAppearance(tx: Prisma.TransactionClient, actor: StudioActor) {
    return tx.storeAppearance.upsert({
      where: { companyId: actor.companyId },
      create: {
        companyId: actor.companyId,
        draft: defaultAppearance,
        updatedByMembershipId: actor.membershipId,
      },
      update: {},
    });
  }

  async appearance(actor: StudioActor) {
    const row = await this.write(actor, "appearance", (tx) =>
      this.ensureAppearance(tx, actor),
    );
    return {
      draft: parseAppearance(row.draft),
      draftVersion: row.draftVersion,
      publishedVersion: row.publishedVersion,
      publishedAt: row.publishedAt,
      canRestore: !!row.previousPublished,
    };
  }

  private async checkMedia(
    tx: Prisma.TransactionClient,
    companyId: string,
    definition: AppearanceDefinition,
  ) {
    for (const [id, purpose] of [
      [definition.logoAssetId, "LOGO"],
      [definition.coverAssetId, "HERO"],
    ] as const) {
      if (
        id &&
        !(await tx.storeMediaAsset.findFirst({
          where: { companyId, id, state: "READY", purpose },
          select: { id: true },
        }))
      )
        throw new BadRequestException(
          "El medio no está preparado o no pertenece a esta tienda y propósito",
        );
    }
  }

  async saveDraft(actor: StudioActor, input: StudioDraftDto) {
    const draft = parseAppearance(input.draft);
    return this.write(actor, "appearance", async (tx) => {
      const current = await this.ensureAppearance(tx, actor);
      if (current.draftVersion !== input.expectedDraftVersion)
        throw new ConflictException(
          "El borrador cambió. Recarga y revisa los cambios.",
        );
      await this.checkMedia(tx, actor.companyId, draft);
      const row = await tx.storeAppearance.update({
        where: { companyId: actor.companyId },
        data: {
          draft,
          draftVersion: { increment: 1 },
          updatedByMembershipId: actor.membershipId,
        },
      });
      await this.log(tx, actor, "StoreAppearance", actor.companyId, {
        draftVersion: row.draftVersion,
      });
      return {
        draft,
        draftVersion: row.draftVersion,
        publishedVersion: row.publishedVersion,
      };
    });
  }

  async publish(actor: StudioActor, input: StudioPublishDto) {
    return this.write(actor, "appearance", async (tx) => {
      const current = await this.ensureAppearance(tx, actor);
      if (
        current.draftVersion !== input.expectedDraftVersion ||
        current.publishedVersion !== input.expectedPublishedVersion
      )
        throw new ConflictException(
          "La apariencia cambió. Revisa las versiones antes de publicar.",
        );
      const published = parseAppearance(current.draft);
      await this.checkMedia(tx, actor.companyId, published);
      const row = await tx.storeAppearance.update({
        where: { companyId: actor.companyId },
        data: {
          published,
          previousPublished: current.published ?? Prisma.DbNull,
          publishedVersion: (current.publishedVersion ?? 0) + 1,
          publishedAt: new Date(),
          updatedByMembershipId: actor.membershipId,
        },
      });
      await this.log(tx, actor, "StoreAppearance", actor.companyId, {
        publishedVersion: row.publishedVersion,
      });
      await this.notice(
        tx,
        actor,
        "La apariencia de la tienda fue publicada",
        "/comercio/apariencia",
      );
      return { publishedVersion: row.publishedVersion };
    });
  }

  async restore(actor: StudioActor, expectedVersion: number) {
    return this.write(actor, "appearance", async (tx) => {
      const current = await this.ensureAppearance(tx, actor);
      if (current.publishedVersion !== expectedVersion)
        throw new ConflictException(
          "La publicación cambió. Recarga antes de restaurar.",
        );
      if (!current.previousPublished)
        throw new BadRequestException("No hay publicación anterior");
      const previous = parseAppearance(current.previousPublished);
      await this.checkMedia(tx, actor.companyId, previous);
      await tx.storeAppearance.update({
        where: { companyId: actor.companyId },
        data: {
          published: previous,
          previousPublished: current.published ?? Prisma.DbNull,
          publishedVersion: expectedVersion + 1,
          publishedAt: new Date(),
          updatedByMembershipId: actor.membershipId,
        },
      });
      await this.log(tx, actor, "StoreAppearance", actor.companyId, {
        restored: true,
        publishedVersion: expectedVersion + 1,
      });
      await this.notice(
        tx,
        actor,
        "Se restauró la publicación anterior de la tienda",
        "/comercio/apariencia",
      );
      return { restored: true };
    });
  }

  async preview(actor: StudioActor) {
    const row = await this.appearance(actor);
    return {
      ...row,
      assets: await this.prisma.storeMediaAsset.findMany({
        where: {
          companyId: actor.companyId,
          state: "READY",
          id: {
            in: [row.draft.logoAssetId, row.draft.coverAssetId].filter(
              (id): id is string => !!id,
            ),
          },
        },
        select: mediaSelect,
      }),
    };
  }

  async upload(actor: StudioActor, input: StudioMediaDto) {
    const parsed = await parseImageDataUrl(input.image);
    const { data, info } = await sharp(parsed.buffer)
      .resize(
        input.purpose === "LOGO" ? 512 : 1600,
        input.purpose === "LOGO" ? 512 : 1600,
        { fit: "inside", withoutEnlargement: true },
      )
      .webp({ quality: 85 })
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 1_000_000)
      throw new BadRequestException("Reduce el tamaño de la imagen");
    return this.write(actor, "appearance", async (tx) => {
      if (
        (await tx.storeMediaAsset.count({
          where: { companyId: actor.companyId },
        })) >= 50
      )
        throw new BadRequestException(
          "Límite de 50 medios por tienda. Los medios sin referencias se purgan tras 30 días.",
        );
      const result = await tx.storeMediaAsset.create({
        data: {
          companyId: actor.companyId,
          uploadedByMembershipId: actor.membershipId,
          purpose: input.purpose,
          storageKey: `stores/${actor.companyId}/${randomUUID()}.webp`,
          mimeType: "image/webp",
          byteSize: data.length,
          width: info.width,
          height: info.height,
          checksum: createHash("sha256").update(data).digest("hex"),
          content: new Uint8Array(data),
        },
        select: mediaSelect,
      });
      await this.log(tx, actor, "StoreMediaAsset", result.id, {
        purpose: result.purpose,
        byteSize: result.byteSize,
      });
      return result;
    });
  }

  media(actor: StudioActor) {
    return this.prisma.storeMediaAsset.findMany({
      where: { companyId: actor.companyId, state: { not: "ARCHIVED" } },
      select: mediaSelect,
      take: 50,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  private referenced(id: string, values: unknown[]): boolean {
    return values.some(
      (value) =>
        value &&
        typeof value === "object" &&
        ((value as Record<string, unknown>).logoAssetId === id ||
          (value as Record<string, unknown>).coverAssetId === id),
    );
  }

  async archive(actor: StudioActor, id: string) {
    return this.write(actor, "appearance", async (tx) => {
      const appearance = await tx.storeAppearance.findUnique({
        where: { companyId: actor.companyId },
      });
      if (
        this.referenced(id, [
          appearance?.draft,
          appearance?.published,
          appearance?.previousPublished,
        ])
      )
        throw new ConflictException(
          "El medio se usa en un borrador o publicación. Reemplázalo primero.",
        );
      const row = await tx.storeMediaAsset.updateMany({
        where: { companyId: actor.companyId, id },
        data: { state: "ARCHIVED", archivedAt: new Date() },
      });
      if (!row.count) throw new NotFoundException();
      await this.log(tx, actor, "StoreMediaAsset", id, { archived: true });
      return { archived: true };
    });
  }

  async content(companyId: string, id: string) {
    const media = await this.prisma.storeMediaAsset.findFirst({
      where: { companyId, id, state: "READY" },
      select: { content: true, mimeType: true },
    });
    if (!media) throw new NotFoundException();
    return media;
  }

  async publicAppearance(companyId: string, slug: string) {
    if (!(await this.features(companyId)).appearance) return null;
    const row = await this.prisma.storeAppearance.findUnique({
      where: { companyId },
    });
    for (const candidate of [row?.published, row?.previousPublished]) {
      const result = appearanceSchema.safeParse(candidate);
      if (!result.success) continue;
      try {
        await this.checkMedia(this.prisma, companyId, result.data);
      } catch {
        continue;
      }
      const { logoAssetId, coverAssetId, ...config } = result.data;
      const url = (id: string | null) =>
        id
          ? `/api/store/${encodeURIComponent(slug)}/appearance-media/${encodeURIComponent(id)}`
          : null;
      return {
        ...config,
        logoUrl: url(logoAssetId),
        coverUrl: url(coverAssetId),
      };
    }
    return null;
  }

  async publicContent(companyId: string, slug: string, id: string) {
    const appearance = await this.publicAppearance(companyId, slug);
    const url = `/api/store/${encodeURIComponent(slug)}/appearance-media/${encodeURIComponent(id)}`;
    if (
      !appearance ||
      (appearance.logoUrl !== url && appearance.coverUrl !== url)
    )
      throw new NotFoundException();
    return this.content(companyId, id);
  }

  async notes(actor: StudioActor, orderId: string) {
    if (
      !(await this.prisma.storeOrder.findFirst({
        where: { companyId: actor.companyId, id: orderId },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    return this.prisma.storeOrderInternalNote.findMany({
      where: { companyId: actor.companyId, orderId },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { user: { select: { fullName: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async addNote(actor: StudioActor, orderId: string, body: string) {
    return this.write(actor, "notes", async (tx) => {
      if (
        !(await tx.storeOrder.findFirst({
          where: { companyId: actor.companyId, id: orderId },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
      const note = await tx.storeOrderInternalNote.create({
        data: {
          companyId: actor.companyId,
          orderId,
          authorMembershipId: actor.membershipId,
          body,
        },
      });
      await this.log(tx, actor, "StoreOrderInternalNote", note.id, {
        orderId,
        length: body.length,
      });
      await this.notice(
        tx,
        actor,
        "Se agregó una nota interna a un pedido",
        `/comercio/pedidos/${orderId}`,
      );
      return { id: note.id };
    });
  }

  async views(actor: StudioActor, resource: string) {
    const rows = await this.prisma.storeSavedView.findMany({
      where: {
        companyId: actor.companyId,
        membershipId: actor.membershipId,
        resource,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      take: 20,
    });
    return rows.flatMap((row) => {
      try {
        return [
          {
            id: row.id,
            resource: row.resource,
            name: row.name,
            isDefault: row.isDefault,
            version: row.version,
            definition: studioDefinition(resource, row.definition),
          },
        ];
      } catch {
        this.logger.warn(`Vista inválida omitida ${row.id}`);
        return [];
      }
    });
  }

  async saveView(
    actor: StudioActor,
    input: StudioViewDto | StudioViewUpdateDto,
    id?: string,
  ) {
    const definition = studioDefinition(input.resource, input.definition);
    return this.write(actor, "savedViews", async (tx) => {
      const where = {
        companyId: actor.companyId,
        membershipId: actor.membershipId,
        resource: input.resource,
      };
      if (id) {
        const prior = await tx.storeSavedView.findFirst({
          where: { ...where, id },
        });
        if (!prior) throw new NotFoundException();
        if (
          !("expectedVersion" in input) ||
          prior.version !== input.expectedVersion
        )
          throw new ConflictException(
            "La vista cambió. Recarga antes de guardar.",
          );
      } else if ((await tx.storeSavedView.count({ where })) >= 20)
        throw new BadRequestException("Máximo 20 vistas por recurso");
      if (input.isDefault)
        await tx.storeSavedView.updateMany({
          where: {
            ...where,
            isDefault: true,
            ...(id ? { id: { not: id } } : {}),
          },
          data: { isDefault: false, version: { increment: 1 } },
        });
      const values = {
        name: input.name,
        definition,
        isDefault: input.isDefault,
      };
      const row = id
        ? await tx.storeSavedView.update({
            where: { id },
            data: { ...values, version: { increment: 1 } },
          })
        : await tx.storeSavedView.create({ data: { ...where, ...values } });
      await this.log(tx, actor, "StoreSavedView", row.id, {
        resource: input.resource,
        version: row.version,
      });
      return { id: row.id };
    });
  }

  async deleteView(actor: StudioActor, id: string, expectedVersion: number) {
    return this.write(actor, "savedViews", async (tx) => {
      const row = await tx.storeSavedView.findFirst({
        where: {
          id,
          companyId: actor.companyId,
          membershipId: actor.membershipId,
        },
      });
      if (!row) throw new NotFoundException();
      if (row.version !== expectedVersion)
        throw new ConflictException(
          "La vista cambió. Recarga antes de eliminar.",
        );
      await tx.storeSavedView.delete({ where: { id } });
      await this.log(tx, actor, "StoreSavedView", id, { deleted: true });
      return { deleted: true };
    });
  }

  @Interval(3_600_000)
  async cleanMedia() {
    try {
      const candidates = await this.prisma.storeMediaAsset.findMany({
        where: {
          createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
          ...(this.mediaCursor ? { id: { gt: this.mediaCursor } } : {}),
        },
        select: { id: true, companyId: true },
        take: 50,
        orderBy: { id: "asc" },
      });
      for (const candidate of candidates)
        await serializableTransaction(this.prisma, async (tx) => {
          await tx.$queryRaw`SELECT id FROM companies WHERE id = ${candidate.companyId} FOR UPDATE`;
          const row = await tx.storeAppearance.findUnique({
            where: { companyId: candidate.companyId },
          });
          if (
            !this.referenced(candidate.id, [
              row?.draft,
              row?.published,
              row?.previousPublished,
            ])
          )
            await tx.storeMediaAsset.deleteMany({
              where: { id: candidate.id, companyId: candidate.companyId },
            });
        });
      this.mediaCursor =
        candidates.length === 50 ? candidates.at(-1)?.id : undefined;
    } catch {
      this.logger.warn("Se reintentará la limpieza de medios sin referencias");
    }
  }
}
