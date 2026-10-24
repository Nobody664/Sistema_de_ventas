import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PlatformGuard } from "@/common/guards/platform.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { SupportTicketsService } from "@/modules/support/support-tickets.service";
import { SupportChatService } from "@/modules/support/support-chat.service";
import {
  AssignTicketDto,
  CreateTicketCommentDto,
  QueryTicketsDto,
  UpdateTicketStatusDto,
} from "@/modules/support/dto/ticket.dto";
import {
  QueryConversationsDto,
  SendMessageDto,
  UpdateConversationStatusDto,
} from "@/modules/support/dto/chat.dto";
import { PlatformAuditService } from "./platform-audit.service";
import { SupportFaqService } from "@/modules/support/support-faq.service";
import {
  CreateFaqDto,
  QueryFaqDto,
  UpdateFaqDto,
} from "@/modules/support/dto/faq.dto";
import { Delete } from "@nestjs/common";

@Controller("platform/support")
@Roles("SUPER_ADMIN", "SUPPORT_ADMIN")
@UseGuards(JwtAuthGuard, PlatformGuard, PermissionsGuard)
@Permissions(Permission.PLATFORM_SUPPORT_MANAGE)
export class PlatformSupportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: SupportTicketsService,
    private readonly chat: SupportChatService,
    private readonly audit: PlatformAuditService,
    private readonly faqs: SupportFaqService,
  ) {}

  @Get("faqs")
  @Permissions(Permission.PLATFORM_SUPPORT_MANAGE, Permission.SUPPORT_FAQ_VIEW)
  listFaqs(@CurrentUser() user: AuthUser, @Query() query: QueryFaqDto) {
    return this.faqs.findAll({ userId: user.sub, isPlatform: true }, query);
  }

  @Post("faqs")
  @Permissions(
    Permission.PLATFORM_SUPPORT_MANAGE,
    Permission.SUPPORT_FAQ_MANAGE,
  )
  async createFaq(@CurrentUser() user: AuthUser, @Body() input: CreateFaqDto) {
    const faq = await this.faqs.create(
      { userId: user.sub, isPlatform: true },
      input,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.CREATE,
      entity: "SupportFaq",
      entityId: faq.id,
      changes: { scope: faq.scope, companyId: faq.companyId },
    });
    return faq;
  }

  @Patch("faqs/:id")
  @Permissions(
    Permission.PLATFORM_SUPPORT_MANAGE,
    Permission.SUPPORT_FAQ_MANAGE,
  )
  async updateFaq(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: UpdateFaqDto,
  ) {
    const faq = await this.faqs.update(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "SupportFaq",
      entityId: id,
      changes: input,
    });
    return faq;
  }

  @Delete("faqs/:id")
  @Permissions(
    Permission.PLATFORM_SUPPORT_MANAGE,
    Permission.SUPPORT_FAQ_MANAGE,
  )
  async deleteFaq(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const result = await this.faqs.remove(
      { userId: user.sub, isPlatform: true },
      id,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.DELETE,
      entity: "SupportFaq",
      entityId: id,
    });
    return result;
  }

  @Get("agents")
  getAgents() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        globalRole: { in: ["SUPER_ADMIN", "SUPPORT_ADMIN"] },
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });
  }

  @Get("tickets")
  listTickets(@CurrentUser() user: AuthUser, @Query() query: QueryTicketsDto) {
    return this.tickets.findAll({ userId: user.sub, isPlatform: true }, query);
  }

  @Get("tickets/:id")
  getTicket(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.tickets.findById({ userId: user.sub, isPlatform: true }, id);
  }

  @Post("tickets/:id/comments")
  replyTicket(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: CreateTicketCommentDto,
  ) {
    return this.tickets.addComment(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
  }

  @Patch("tickets/:id/status")
  async ticketStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: UpdateTicketStatusDto,
  ) {
    const result = await this.tickets.updateStatus(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "SupportTicket",
      entityId: id,
      changes: { status: input.status },
    });
    return result;
  }

  @Get("chat")
  listChats(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryConversationsDto,
  ) {
    return this.chat.findAll({ userId: user.sub, isPlatform: true }, query);
  }

  @Get("chat/:id")
  getChat(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chat.findById({ userId: user.sub, isPlatform: true }, id);
  }

  @Get("chat/:id/messages")
  messages(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chat.listMessages({ userId: user.sub, isPlatform: true }, id);
  }

  @Post("chat/:id/messages")
  replyChat(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: SendMessageDto,
  ) {
    return this.chat.sendMessage(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
  }

  @Patch("chat/:id/status")
  async chatStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: UpdateConversationStatusDto,
  ) {
    const result = await this.chat.updateStatus(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "SupportConversation",
      entityId: id,
      changes: { status: input.status },
    });
    return result;
  }

  @Patch("tickets/:id/assign")
  async assignTicket(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: AssignTicketDto,
  ) {
    const result = await this.tickets.assign(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "SupportTicket",
      entityId: id,
      changes: { assignedToId: input.assignedToId ?? null },
    });
    return result;
  }

  @Patch("chat/:id/assign")
  async assignChat(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() input: AssignTicketDto,
  ) {
    const result = await this.chat.assign(
      { userId: user.sub, isPlatform: true },
      id,
      input,
    );
    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.UPDATE,
      entity: "SupportConversation",
      entityId: id,
      changes: { assignedToId: input.assignedToId ?? null },
    });
    return result;
  }
}
