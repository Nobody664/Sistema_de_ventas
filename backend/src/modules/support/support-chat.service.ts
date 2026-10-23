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
} from "./dto/chat.dto";

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

    return conversation;
  }

  async findAll(actor: ChatActor, query: QueryConversationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (actor.isPlatform) {
      if (query.companyId) {
        where.companyId = query.companyId;
      } else {
        where.OR = [
          { companyId: null },
          { participants: { some: { userId: actor.userId } } },
        ];
      }
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

  async listMessages(actor: ChatActor, id: string) {
    await this.findById(actor, id);

    return this.prisma.supportMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, email: true, fullName: true } },
      },
    });
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
      participants: { userId: string }[];
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
        }),
      ),
    );
  }
}
