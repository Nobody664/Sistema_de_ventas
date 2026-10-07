import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { PaymentSettingsService } from './payment-settings.service';

describe('PaymentSettingsService proof scoping', () => {
  it('404s when the proof belongs to another company', async () => {
    const prisma = {
      paymentProof: {
        findUnique: async () => ({
          id: 'proof-1',
          subscription: { companyId: 'com-other' },
        }),
      },
    } as any;
    const svc = new PaymentSettingsService(prisma);

    await assert.rejects(
      () => svc.getProofById('proof-1', 'com-a'),
      NotFoundException,
    );
  });

  it('returns the proof without subscription info when it belongs to the company', async () => {
    const prisma = {
      paymentProof: {
        findUnique: async () => ({
          id: 'proof-1',
          amount: 99,
          subscription: { companyId: 'com-a' },
        }),
      },
    } as any;
    const svc = new PaymentSettingsService(prisma);

    const proof = (await svc.getProofById('proof-1', 'com-a')) as any;
    assert.equal(proof.id, 'proof-1');
    assert.equal(proof.subscription, undefined);
  });

  it('404s when uploading a proof for a subscription of another company', async () => {
    const prisma = {
      subscription: { findFirst: async () => null },
    } as any;
    const svc = new PaymentSettingsService(prisma);

    await assert.rejects(
      () =>
        svc.uploadPaymentProof('sub-other', {
          imageBase64: 'data:image/png;base64,x',
          amount: 100,
        } as any, 'com-a'),
      NotFoundException,
    );
  });

  it('creates the proof only against the scoped subscription', async () => {
    const createData: any[] = [];
    const prisma = {
      subscription: {
        findFirst: async (args: any) =>
          args.where.id === 'sub-a' && args.where.companyId === 'com-a'
            ? { id: 'sub-a' }
            : null,
      },
      paymentProof: {
        create: async (args: any) => {
          createData.push(args);
          return { id: 'proof-new', ...args.data };
        },
      },
    } as any;
    const svc = new PaymentSettingsService(prisma);

    const proof = (await svc.uploadPaymentProof('sub-a', {
      imageBase64: 'data:image/png;base64,x',
      amount: 100,
    } as any, 'com-a')) as any;

    assert.equal(proof.id, 'proof-new');
    assert.equal(createData[0].data.subscriptionId, 'sub-a');
  });
});