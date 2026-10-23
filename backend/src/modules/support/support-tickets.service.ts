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
  SupportTicketPriority,
  SupportTicketSource,
  SupportTicketStatus,
} from "@prisma/client";
import {
  AssignTicketDto,
  CloseTicketDto,
  CreateTicketCommentDto,
  CreateTicketDto,
  QueryTicketsDto,
  TICKET_SLA_MINUTES,
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from "./dto/ticket.dto";

const TICKET_INCLUDE = {
  requester: { select: { id: true, email: true, fullName: true } },
  assignedTo: { select: { id: true, email: true, fullName: true } },
  company: { select: { id: true, name: true } },
};

const TICKET_DETAIL_INCLUDE = {
  ...TICKET_INCLUDE,
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, email: true, fullName: true } } },
  },
  history: {
    orderBy: { createdAt: "asc" as const },
    include: {
      changedBy: { select: { id: true, email: true, fullName: true } },
    },
  },
};

export interface TicketActor {
  userId: string;
  companyId?: string | null;
  isPlatform: boolean;
}

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private resolveCompanyId(
    actor: TicketActor,
    requestedCompanyId?: string,
  ): string {
    if (actor.isPlatform) {
      const companyId = requestedCompanyId ?? actor.companyId;
      if (!companyId) {
        throw new BadRequestException("Se requiere companyId.");
      }
      return companyId;
    }

    if (!actor.companyId) {
      throw new BadRequestException("Se requiere companyId.");
    }
    return actor.companyId;
  }

  async create(actor: TicketActor, dto: CreateTicketDto) {
    const companyId = this.resolveCompanyId(actor, dto.companyId);
    const priority = dto.priority ?? SupportTicketPriority.MEDIUM;
    const slaDueAt = new Date(
      Date.now() + TICKET_SLA_MINUTES[priority] * 60 * 1000,
    );

    const ticket = await this.prisma.supportTicket.create({
      data: {
        companyId,
        requesterId: actor.userId,
        title: dto.title,
        description: dto.description,
        priority,
        source: dto.source ?? SupportTicketSource.FORM,
        slaDueAt,
      },
      include: TICKET_INCLUDE,
    });

    await this.notifyAssignees(ticket, {
      title: "Nuevo ticket de soporte",
      message: `Se creó el ticket "${ticket.title}" (${priority}).`,
    });

    return ticket;
  }

  async findAll(actor: TicketActor, query: QueryTicketsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }

    if (actor.isPlatform) {
      if (query.companyId) {
        where.companyId = query.companyId;
      }
      if (query.assignment === "mine") where.assignedToId = actor.userId;
      if (query.assignment === "unassigned") where.assignedToId = null;
    } else {
      where.companyId = this.resolveCompanyId(actor);
    }

    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: TICKET_INCLUDE,
        orderBy: [{ createdAt: "desc" }],
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(actor: TicketActor, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: TICKET_DETAIL_INCLUDE,
    });

    if (!ticket) {
      throw new NotFoundException("Ticket not found.");
    }
    this.assertAccess(actor, ticket.companyId);

    return actor.isPlatform
      ? ticket
      : {
          ...ticket,
          comments: ticket.comments.filter((comment) => !comment.isInternal),
        };
  }

  async update(actor: TicketActor, id: string, dto: UpdateTicketDto) {
    const ticket = await this.getAccessibleTicket(actor, id);

    return this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
      },
      include: TICKET_INCLUDE,
    });
  }

  async updateStatus(
    actor: TicketActor,
    id: string,
    dto: UpdateTicketStatusDto,
  ) {
    const ticket = await this.getAccessibleTicket(actor, id);

    const data: Record<string, unknown> = { status: dto.status };
    if (dto.status === SupportTicketStatus.RESOLVED && !ticket.resolvedAt) {
      data.resolvedAt = new Date();
    }
    if (dto.status === SupportTicketStatus.CLOSED && !ticket.closedAt) {
      data.closedAt = new Date();
    }
    if (
      !ticket.firstResponseAt &&
      dto.status !== SupportTicketStatus.OPEN &&
      actor.isPlatform
    ) {
      data.firstResponseAt = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.supportTicketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: ticket.status,
          toStatus: dto.status,
          changedById: actor.userId,
          reason: dto.reason,
        },
      });

      return tx.supportTicket.update({
        where: { id: ticket.id },
        data,
        include: TICKET_INCLUDE,
      });
    });
  }

  async assign(actor: TicketActor, id: string, dto: AssignTicketDto) {
    if (!actor.isPlatform)
      throw new ForbiddenException(
        "Solo los administradores de plataforma pueden asignar tickets",
      );
    const ticket = await this.getAccessibleTicket(actor, id);
    const assignedToId = dto.assignedToId ?? null;

    if (assignedToId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, globalRole: true, isActive: true },
      });
      if (!assignee) {
        throw new NotFoundException("Assignee not found.");
      }
      if (
        !assignee.isActive ||
        !["SUPER_ADMIN", "SUPPORT_ADMIN"].includes(assignee.globalRole)
      ) {
        throw new BadRequestException(
          "El agente debe ser un administrador de plataforma activo",
        );
      }
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { assignedToId, assignedAt: assignedToId ? new Date() : null },
      include: TICKET_INCLUDE,
    });

    if (assignedToId) {
      await this.notificationsService.create({
        userId: assignedToId,
        companyId: ticket.companyId,
        type: NotificationType.GENERAL,
        channel: NotificationChannel.IN_APP,
        title: "Ticket asignado",
        message: `Se te asignó el ticket "${ticket.title}".`,
        data: { ticketId: ticket.id },
        scope: "PLATFORM",
        actionUrl: `/platform/support?ticket=${ticket.id}`,
      });
    }

    return updated;
  }

  async addComment(
    actor: TicketActor,
    id: string,
    dto: CreateTicketCommentDto,
  ) {
    const ticket = await this.getAccessibleTicket(actor, id);
    const isInternal = Boolean(dto.isInternal) && actor.isPlatform;

    const comment = await this.prisma.supportTicketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: actor.userId,
        isInternal,
        content: dto.content,
      },
      include: {
        author: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!isInternal) {
      if (actor.isPlatform) {
        await this.prisma.supportTicket.updateMany({
          where: { id: ticket.id, firstResponseAt: null },
          data: { firstResponseAt: new Date() },
        });
        await this.notifyRequester(ticket, {
          title: "Nueva respuesta en tu ticket",
          message: `Hay una nueva respuesta en "${ticket.title}".`,
        });
      } else {
        await this.notifyAssignees(ticket, {
          title: "Respuesta de empresa",
          message: `La empresa respondió en "${ticket.title}".`,
        });
      }
    }

    return comment;
  }

  async close(actor: TicketActor, id: string, dto: CloseTicketDto) {
    return this.updateStatus(actor, id, {
      status: SupportTicketStatus.CLOSED,
      reason: dto.reason,
    });
  }

  async reopen(actor: TicketActor, id: string) {
    const ticket = await this.getAccessibleTicket(actor, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.supportTicketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: ticket.status,
          toStatus: SupportTicketStatus.OPEN,
          changedById: actor.userId,
          reason: "Reapertura",
        },
      });

      return tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: SupportTicketStatus.OPEN,
          closedAt: null,
          resolvedAt: null,
        },
        include: TICKET_INCLUDE,
      });
    });
  }

  async getMetrics(actor: TicketActor, companyId?: string) {
    const scopeCompanyId = actor.isPlatform
      ? companyId
      : this.resolveCompanyId(actor);
    const where = scopeCompanyId ? { companyId: scopeCompanyId } : {};

    const [open, byPriority, resolved] = await Promise.all([
      this.prisma.supportTicket.count({
        where: { ...where, status: SupportTicketStatus.OPEN },
      }),
      this.prisma.supportTicket.groupBy({
        by: ["priority"],
        where,
        _count: { priority: true },
      }),
      this.prisma.supportTicket.findMany({
        where: {
          ...where,
          resolvedAt: { not: null },
          firstResponseAt: { not: null },
        },
        select: { createdAt: true, firstResponseAt: true, resolvedAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    let frtSum = 0;
    let ttrSum = 0;
    for (const ticket of resolved) {
      if (ticket.firstResponseAt) {
        frtSum += ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
      }
      if (ticket.resolvedAt) {
        ttrSum += ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      }
    }

    const sample = resolved.length || 1;

    return {
      openTickets: open,
      byPriority: byPriority.reduce<Record<string, number>>((acc, row) => {
        acc[row.priority] = row._count.priority;
        return acc;
      }, {}),
      avgFirstResponseMinutes: Math.round(frtSum / sample / 60000),
      avgResolutionMinutes: Math.round(ttrSum / sample / 60000),
    };
  }

  private assertAccess(actor: TicketActor, ticketCompanyId: string) {
    if (!actor.isPlatform && actor.companyId !== ticketCompanyId) {
      throw new NotFoundException("Ticket not found.");
    }
  }

  private async getAccessibleTicket(actor: TicketActor, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket not found.");
    }
    this.assertAccess(actor, ticket.companyId);
    return ticket;
  }

  private async notifyAssignees(
    ticket: { id: string; companyId: string; title: string },
    payload: { title: string; message: string },
  ) {
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
          companyId: ticket.companyId,
          type: NotificationType.GENERAL,
          channel: NotificationChannel.IN_APP,
          title: payload.title,
          message: payload.message,
          data: { ticketId: ticket.id },
          scope: "PLATFORM",
          actionUrl: `/platform/support?ticket=${ticket.id}`,
        }),
      ),
    );
  }

  private async notifyRequester(
    ticket: {
      id: string;
      companyId: string;
      title: string;
      requesterId: string;
    },
    payload: { title: string; message: string },
  ) {
    await this.notificationsService.create({
      userId: ticket.requesterId,
      companyId: ticket.companyId,
      type: NotificationType.GENERAL,
      channel: NotificationChannel.IN_APP,
      title: payload.title,
      message: payload.message,
      data: { ticketId: ticket.id },
      actionUrl: `/support/tickets/${ticket.id}`,
    });
  }
}
