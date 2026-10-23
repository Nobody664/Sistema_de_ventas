import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Res,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { NotificationsService } from "./notifications.service";
import { TenantGuard } from "@/common/guards/tenant.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthUser,
} from "@/common/decorators/current-user.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("stream")
  streamNotifications(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendToClient = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const unsubscribe = this.notificationsService.subscribe(
      user.sub,
      sendToClient,
    );

    res.on("close", () => {
      unsubscribe();
    });
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.notificationsService.findByUser(user.sub, {
      unreadOnly: unreadOnly === "true",
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("company")
  findByCompany(
    @Req() request: { tenantId: string },
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.notificationsService.findByCompany(request.tenantId, {
      unreadOnly: unreadOnly === "true",
    });
  }

  @Get("unread-count")
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user.sub);
    return { count };
  }

  @Patch(":id/read")
  async markAsRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Patch("read-all")
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
