import {
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";
import { withDeadline } from "@/common/helpers/deadline.helper";

@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  private readonly connections = new Map<string, Set<() => void>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sessionActive(user: AuthUser): Promise<boolean> {
    if (!user.sid || !user.tokenExpiresAt || user.tokenExpiresAt <= Date.now())
      return false;
    const current = await withDeadline(
      this.prisma.user.findUnique({
        where: { id: user.sub },
        select: {
          isActive: true,
          authVersion: true,
          globalRole: true,
          employee: {
            select: { companyId: true, isActive: true, deletedAt: true },
          },
          refreshTokens: {
            where: {
              familyId: user.sid,
              companyId: user.companyId ?? null,
              authVersion: user.authVersion ?? 0,
              revokedAt: null,
              type: "SESSION",
              expiresAt: { gt: new Date() },
            },
            take: 1,
            select: { id: true },
          },
          memberships: {
            where: { companyId: user.companyId ?? "", isActive: true },
            take: 1,
            select: { role: true },
          },
        },
      }),
    );
    if (
      !current?.isActive ||
      current.authVersion !== (user.authVersion ?? 0) ||
      !current.refreshTokens.length ||
      !user.roles.includes(current.globalRole)
    )
      return false;
    if (user.companyId)
      return (
        !!current.memberships[0] &&
        user.roles.includes(current.memberships[0].role) &&
        !(
          current.employee?.companyId === user.companyId &&
          (!current.employee.isActive || current.employee.deletedAt)
        )
      );
    return current.globalRole !== "USER";
  }

  async open(user: AuthUser, response: Response): Promise<void> {
    const sessions = this.connections.get(user.sub) ?? new Set<() => void>();
    if (sessions.size >= 3)
      throw new HttpException(
        "Máximo de tres streams por usuario y réplica",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    let unsubscribe: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let expiration: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(expiration);
      unsubscribe?.();
      sessions.delete(close);
      if (!sessions.size) this.connections.delete(user.sub);
      response.off("close", close);
      response.off("error", close);
      if (!response.writableEnded) response.end();
    };
    sessions.add(close);
    this.connections.set(user.sub, sessions);
    response.once("close", close);
    response.once("error", close);
    try {
      if (!(await this.sessionActive(user)))
        throw new UnauthorizedException("La sesión debe renovarse");
      if (closed) return;
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("X-Accel-Buffering", "no");
      response.flushHeaders();
      const write = (data: string): void => {
        if (!closed && !response.write(data)) close();
      };
      write(": connected\n\n");
      if (closed) return;
      unsubscribe = this.notifications.subscribe(user.sub, (data: unknown) =>
        write(`data: ${JSON.stringify(data)}\n\n`),
      );
      let checking = false;
      heartbeat = setInterval(() => {
        if (checking || closed) return;
        checking = true;
        void this.sessionActive(user)
          .then((active) => {
            if (!active) close();
            else write(": heartbeat\n\n");
          })
          .catch(close)
          .finally(() => {
            checking = false;
          });
      }, 15000);
      expiration = setTimeout(
        close,
        Math.max(0, Math.min(300000, user.tokenExpiresAt! - Date.now())),
      );
      heartbeat.unref();
      expiration.unref();
    } catch (error) {
      sessions.delete(close);
      if (!sessions.size) this.connections.delete(user.sub);
      response.off("close", close);
      response.off("error", close);
      if (response.headersSent) close();
      throw error;
    }
  }

  onModuleDestroy(): void {
    for (const sessions of this.connections.values())
      for (const close of [...sessions]) close();
  }
}
