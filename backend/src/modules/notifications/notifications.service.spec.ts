import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService markAsRead ownership', () => {
  it('404s when the notification belongs to another user', async () => {
    const prisma = {
      notification: {
        findFirst: async () => null,
        update: async () => ({}),
      },
    } as any;
    const svc = new NotificationsService(prisma);

    await assert.rejects(() => svc.markAsRead('n1', 'user-b'), NotFoundException);
  });

  it('marks as read only a notification owned by the current user', async () => {
    let updateWhere: any;
    const prisma = {
      notification: {
        findFirst: async (args: any) =>
          args.where.id === 'n1' && args.where.userId === 'user-a'
            ? { id: 'n1' }
            : null,
        update: async (args: any) => {
          updateWhere = args.where;
          return { id: 'n1', isRead: true };
        },
      },
    } as any;
    const svc = new NotificationsService(prisma);

    const result = await svc.markAsRead('n1', 'user-a');
    assert.equal(result.isRead, true);
    assert.deepEqual(updateWhere, { id: 'n1' });
  });
});