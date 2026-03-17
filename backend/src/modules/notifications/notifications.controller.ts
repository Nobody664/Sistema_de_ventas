import { Controller, Get, Patch, Param, Query, Res, Req, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { NotificationsService } from './notifications.service';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly eventClients: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('stream')
  streamNotifications(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const clientId = user.sub;
    
    if (!this.eventClients.has(clientId)) {
      this.eventClients.set(clientId, new Set());
    }
    
    const clientSet = this.eventClients.get(clientId)!;
    const sendToClient = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    clientSet.add(sendToClient);

    res.on('close', () => {
      clientSet.delete(sendToClient);
      if (clientSet.size === 0) {
        this.eventClients.delete(clientId);
      }
    });
  }

  emitNotification(userId: string, notification: unknown) {
    const clientSet = this.eventClients.get(userId);
    if (clientSet) {
      clientSet.forEach((sendFn) => sendFn(notification));
    }
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findByUser(user.sub, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('company')
  findByCompany(
    @Req() request: { tenantId: string },
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findByCompany(request.tenantId, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user.sub);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
