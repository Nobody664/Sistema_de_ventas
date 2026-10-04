import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditContext {
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditContext>();

  run<T>(context: AuditContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): AuditContext | undefined {
    return this.storage.getStore();
  }
}