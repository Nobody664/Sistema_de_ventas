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
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { Permissions } from "@/common/decorators/permissions.decorator";
import { Permission } from "@/common/constants/permissions.constant";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { SupportTicketsService, TicketActor } from "./support-tickets.service";
import {
  AssignTicketDto,
  CloseTicketDto,
  CreateTicketCommentDto,
  CreateTicketDto,
  QueryTicketsDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from "./dto/ticket.dto";

function toActor(user: AuthUser): TicketActor {
  return {
    userId: user.sub,
    companyId: user.companyId,
    isPlatform:
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("SUPPORT_ADMIN"),
  };
}

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller("support/tickets")
export class SupportTicketsController {
  constructor(private readonly ticketsService: SupportTicketsService) {}

  @Permissions(Permission.SUPPORT_TICKET_LIST)
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTicketsDto) {
    return this.ticketsService.findAll(toActor(user), query);
  }

  @Permissions(Permission.SUPPORT_TICKET_LIST)
  @Get("metrics")
  getMetrics(
    @CurrentUser() user: AuthUser,
    @Query("companyId") companyId?: string,
  ) {
    return this.ticketsService.getMetrics(toActor(user), companyId);
  }

  @Permissions(Permission.SUPPORT_TICKET_LIST)
  @Get(":id")
  findById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.ticketsService.findById(toActor(user), id);
  }

  @Permissions(Permission.SUPPORT_TICKET_CREATE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTicketDto) {
    return this.ticketsService.create(toActor(user), body);
  }

  @Permissions(Permission.SUPPORT_TICKET_MANAGE)
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateTicketDto,
  ) {
    return this.ticketsService.update(toActor(user), id, body);
  }

  @Permissions(Permission.SUPPORT_TICKET_MANAGE)
  @Patch(":id/status")
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(toActor(user), id, body);
  }

  @Permissions(Permission.SUPPORT_TICKET_MANAGE)
  @Patch(":id/assign")
  assign(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: AssignTicketDto,
  ) {
    return this.ticketsService.assign(toActor(user), id, body);
  }

  @Permissions(Permission.SUPPORT_TICKET_MANAGE)
  @Post(":id/comments")
  addComment(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: CreateTicketCommentDto,
  ) {
    return this.ticketsService.addComment(toActor(user), id, body);
  }

  @Permissions(Permission.SUPPORT_TICKET_MANAGE)
  @Post(":id/close")
  close(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: CloseTicketDto,
  ) {
    return this.ticketsService.close(toActor(user), id, body);
  }

  @Permissions(Permission.SUPPORT_TICKET_MANAGE)
  @Post(":id/reopen")
  reopen(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.ticketsService.reopen(toActor(user), id);
  }
}
