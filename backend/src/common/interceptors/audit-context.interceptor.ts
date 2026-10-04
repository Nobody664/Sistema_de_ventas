import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { AuditContextService } from '@/common/services/audit-context.service';

interface RequestWithUser {
  user?: { sub?: string; userId?: string };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly auditContext: AuditContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();

    if (context.getType() !== 'http') {
      return next.handle();
    }

    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ipAddress =
      forwardedIp?.split(',')[0]?.trim() || request.ip || request.socket?.remoteAddress || null;
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    const userId = request.user?.sub ?? request.user?.userId ?? null;

    return defer(() => this.auditContext.run({ userId, ipAddress, userAgent }, () => next.handle()));
  }
}