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
import { SupportChatService, ChatActor } from "./support-chat.service";
import {
  CreateConversationDto,
  QueryConversationsDto,
  SendMessageDto,
  UpdateConversationStatusDto,
} from "./dto/chat.dto";

function toActor(user: AuthUser): ChatActor {
  return {
    userId: user.sub,
    companyId: user.companyId,
    isPlatform:
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("SUPPORT_ADMIN"),
  };
}

@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(Permission.SUPPORT_CHAT)
@Controller("support/chat")
export class SupportChatController {
  constructor(private readonly chatService: SupportChatService) {}

  @Get("conversations")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryConversationsDto,
  ) {
    return this.chatService.findAll(toActor(user), query);
  }

  @Get("conversations/:id")
  findById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chatService.findById(toActor(user), id);
  }

  @Get("conversations/:id/messages")
  listMessages(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chatService.listMessages(toActor(user), id);
  }

  @Post("conversations")
  createConversation(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateConversationDto,
  ) {
    return this.chatService.createConversation(toActor(user), body);
  }

  @Post("conversations/:id/messages")
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: SendMessageDto,
  ) {
    return this.chatService.sendMessage(toActor(user), id, body);
  }

  @Patch("conversations/:id/read")
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chatService.markRead(toActor(user), id);
  }

  @Patch("conversations/:id/status")
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateConversationStatusDto,
  ) {
    return this.chatService.updateStatus(toActor(user), id, body);
  }

  @Post("conversations/:id/convert-to-ticket")
  convertToTicket(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chatService.convertToTicket(toActor(user), id);
  }
}
