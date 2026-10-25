import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  NotificationsService,
  NotificationType,
  NotificationChannel,
} from "@/modules/notifications/notifications.service";
import {
  SupportConversationStatus,
  SupportMessageType,
  SupportParticipantRole,
  SupportTicketPriority,
  SupportTicketSource,
} from "@prisma/client";
import {
  CreateConversationDto,
  QueryConversationsDto,
  SendMessageDto,
  UpdateConversationStatusDto,
  QueryMessagesDto,
} from "./dto/chat.dto";
import { pagination } from "@/common/helpers/query-bounds.helper";
import { AssignTicketDto } from "./dto/ticket.dto";

export interface ChatActor {
  userId: string;
  companyId?: string | null;
  isPlatform: boolean;
}

const CONVERSATION_INCLUDE = {
  createdBy: { select: { id: true, email: true, fullName: true } },
  assignedTo: { select: { id: true, email: true, fullName: true } },
  company: { select: { id: true, name: true } },
  participants: {
    include: {
      user: { select: { id: true, email: true, fullName: true } },
    },
  },
};

@Injectable()
export class SupportChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private resolveCompanyId(
    actor: ChatActor,
    requestedCompanyId?: string,
  ): string | null {
    if (actor.isPlatform) {
      return requestedCompanyId ?? actor.companyId ?? null;
    }
    return actor.companyId ?? null;
  }

  async createConversation(actor: ChatActor, dto: CreateConversationDto) {
    const companyId = this.resolveCompanyId(actor, dto.companyId);

    if (!actor.isPlatform && !companyId) {
      throw new BadRequestException("Se requiere companyId.");
    }

    const conversation = await this.prisma.supportConversation.create({
      data: {
        companyId,
        createdById: actor.userId,
        subject: dto.subject,
        participants: {
          create: {
            userId: actor.userId,
            role: actor.isPlatform
              ? SupportParticipantRole.AGENT
              : SupportParticipantRole.REQUESTER,
          },
        },
      },
      include: CONVERSATION_INCLUDE,
    });

    if (!actor.isPlatform) await this.notifyAgents(conversation);
    return conversation;
  }

  async findAll(actor: ChatActor, query: QueryConversationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    pagination(page, limit);
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (actor.isPlatform) {
      if (query.companyId) {
        where.companyId = query.companyId;
      }
      if (query.assignment === "mine") where.assignedToId = actor.userId;
      if (query.assignment === "unassigned") where.assignedToId = null;
    } else {
      if (!actor.companyId) {
        throw new BadRequestException("Se requiere companyId.");
      }
      where.companyId = actor.companyId;
    }

    const [data, total] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: CONVERSATION_INCLUDE,
        orderBy: { lastMessageAt: "desc" },
      }),
      this.prisma.supportConversation.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(actor: ChatActor, id: string) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id },
      include: CONVERSATION_INCLUDE,
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }
    this.assertAccess(actor, conversation);

    return conversation;
  }

  async listMessages(
    actor: ChatActor,
    id: string,
    query: QueryMessagesDto = {},
  ) {
    await this.findById(actor, id);
    const { limit } = pagination(1, query.limit ?? 50);
    if (query.before && !/^[a-zA-Z0-9_-]{1,128}$/.test(query.before))
      throw new BadRequestException("Cursor inválido");
    const cursor = query.before
      ? await this.prisma.supportMessage.findFirst({
          where: { id: query.before, conversationId: id },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.before && !cursor)
      throw new BadRequestException(
        "Cursor no encontrado en esta conversación",
      );
    const rows = await this.prisma.supportMessage.findMany({
      where: {
        conversationId: id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        sender: { select: { id: true, email: true, fullName: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).reverse();
    return {
      items,
      hasMore,
      nextCursor: hasMore ? (items[0]?.id ?? null) : null,
    };
  }

  async sendMessage(actor: ChatActor, id: string, dto: SendMessageDto) {
    const conversation = await this.findById(actor, id);

    const message = await this.prisma.supportMessage.create({
      data: {
        conversationId: id,
        senderId: actor.userId,
        type: SupportMessageType.TEXT,
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, email: true, fullName: true } },
      },
    });

    await this.prisma.supportConversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        status: SupportConversationStatus.OPEN,
      },
    });

    if (actor.isPlatform) {
      await this.prisma.supportConversation.updateMany({
        where: { id, firstResponseAt: null },
        data: { firstResponseAt: new Date() },
      });
    } else if (!conversation.assignedToId) {
      await this.notifyAgents(conversation);
    }

    await this.notifyParticipants(conversation, actor.userId, {
      title: "Nuevo mensaje de soporte",
      message: `Nuevo mensaje en la conversación "${conversation.subject ?? "Soporte"}".`,
    });

    return message;
  }

  async markRead(actor: ChatActor, id: string) {
    await this.findById(actor, id);

    await this.prisma.supportConversationParticipant.updateMany({
      where: { conversationId: id, userId: actor.userId },
      data: { lastReadAt: new Date() },
    });

    return { ok: true };
  }

  async assign(actor: ChatActor, id: string, dto: AssignTicketDto) {
    if (!actor.isPlatform)
      throw new ForbiddenException(
        "Solo los administradores de plataforma pueden asignar chats",
      );
    await this.findById(actor, id);
    const assignedToId = dto.assignedToId ?? null;
    if (assignedToId) {
      const agent = await this.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { isActive: true, globalRole: true },
      });
      if (
        !agent?.isActive ||
        !["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(agent.globalRole)
      )
        throw new BadRequestException(
          "El agente debe ser un administrador de plataforma activo",
        );
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.supportConversation.update({
        where: { id },
        data: { assignedToId, assignedAt: assignedToId ? new Date() : null },
        include: CONVERSATION_INCLUDE,
      });
      if (assignedToId)
        await tx.supportConversationParticipant.upsert({
          where: {
            conversationId_userId: { conversationId: id, userId: assignedToId },
          },
          create: {
            conversationId: id,
            userId: assignedToId,
            role: SupportParticipantRole.AGENT,
          },
          update: { role: SupportParticipantRole.AGENT },
        });
      return conversation;
    });
    if (assignedToId)
      await this.notificationsService.create({
        userId: assignedToId,
        companyId: result.companyId ?? undefined,
        type: NotificationType.GENERAL,
        title: "Chat asignado",
        message: result.subject ?? "Nueva conversación de soporte",
        scope: "PLATFORM",
        actionUrl: `/platform/support?chat=${id}`,
      });
    return result;
  }

  private async notifyAgents(conversation: {
    id: string;
    companyId: string | null;
    subject: string | null;
  }) {
    const agents = await this.prisma.user.findMany({
      where: {
        isActive: true,
        globalRole: { in: ["SUPER_ADMIN", "SUPPORT_ADMIN"] },
      },
      select: { id: true },
    });
    await Promise.all(
      agents.map((agent) =>
        this.notificationsService.create({
          userId: agent.id,
          companyId: conversation.companyId ?? undefined,
          type: NotificationType.GENERAL,
          title: "Chat de soporte sin asignar",
          message: conversation.subject ?? "Una empresa necesita atención",
          scope: "PLATFORM",
          actionUrl: `/platform/support?chat=${conversation.id}`,
        }),
      ),
    );
  }

  async updateStatus(
    actor: ChatActor,
    id: string,
    dto: UpdateConversationStatusDto,
  ) {
    const conversation = await this.findById(actor, id);

    return this.prisma.supportConversation.update({
      where: { id: conversation.id },
      data: { status: dto.status },
      include: CONVERSATION_INCLUDE,
    });
  }

  async convertToTicket(actor: ChatActor, id: string) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id },
      include: { ...CONVERSATION_INCLUDE, ticket: { select: { id: true } } },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }
    this.assertAccess(actor, conversation);

    if (conversation.ticket) {
      throw new BadRequestException("La conversación ya tiene un ticket.");
    }
    if (!conversation.companyId) {
      throw new BadRequestException(
        "La conversación no está asociada a una empresa.",
      );
    }

    const lastMessages = await this.prisma.supportMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const description = lastMessages
      .reverse()
      .map((message) => message.content)
      .join("\n")
      .slice(0, 5000);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        companyId: conversation.companyId,
        requesterId: conversation.createdById,
        conversationId: conversation.id,
        title: conversation.subject ?? "Ticket desde chat",
        description: description || "Ticket generado desde conversación.",
        priority: SupportTicketPriority.MEDIUM,
        source: SupportTicketSource.CHAT,
      },
    });

    return ticket;
  }

  private assertAccess(
    actor: ChatActor,
    conversation: {
      companyId: string | null;
      participants: { userId: string }[];
    },
  ) {
    if (actor.isPlatform) {
      return;
    }
    if (conversation.companyId && conversation.companyId !== actor.companyId) {
      throw new ForbiddenException("No tienes acceso a esta conversación.");
    }
    if (
      !conversation.companyId &&
      !conversation.participants.some((p) => p.userId === actor.userId)
    ) {
      throw new ForbiddenException("No tienes acceso a esta conversación.");
    }
  }

  private async notifyParticipants(
    conversation: {
      id: string;
      subject: string | null;
      companyId: string | null;
      participants: { userId: string; role?: SupportParticipantRole }[];
    },
    senderId: string,
    payload: { title: string; message: string },
  ) {
    const recipients = conversation.participants
      .map((p) => p.userId)
      .filter((userId) => userId !== senderId);

    await Promise.all(
      recipients.map((userId) =>
        this.notificationsService.create({
          userId,
          companyId: conversation.companyId ?? undefined,
          type: NotificationType.GENERAL,
          channel: NotificationChannel.IN_APP,
          title: payload.title,
          message: payload.message,
          data: { conversationId: conversation.id },
          scope:
            conversation.participants.find((p) => p.userId === userId)?.role ===
            SupportParticipantRole.AGENT
              ? "PLATFORM"
              : "COMPANY",
          actionUrl:
            conversation.participants.find((p) => p.userId === userId)?.role ===
            SupportParticipantRole.AGENT
              ? `/platform/support?chat=${conversation.id}`
              : `/support/chat/${conversation.id}`,
        }),
      ),
    );
  }
}
