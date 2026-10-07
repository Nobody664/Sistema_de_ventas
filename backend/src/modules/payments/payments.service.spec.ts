import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

const SECRET = 'webhook-secret';

function buildSignature(dataId: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = createHmac('sha256', SECRET).update(`${dataId}.${ts}`).digest('hex');
  return { ts, v1, header: `ts=${ts},v1=${v1}`, dataId };
}

function makeService(config: Record<string, string>, query = {}) {
  const configService = {
    get: (key: string) => config[key] ?? null,
  } as any;
  const prisma = {
    payment: { findFirst: async () => null },
    plan: { findUnique: async () => null },
  } as any;
  return new PaymentsService(configService, prisma, {} as any, {} as any);
}

describe('PaymentsService webhook signature', () => {
  it('rejects a webhook when the MP webhook secret is not configured', async () => {
    const svc = makeService({}, {});
    const sig = buildSignature('100500');

    await assert.rejects(
      () => svc.handleWebhook('mercadopago', { status: 'approved' }, { 'x-signature': sig.header }, { 'data.id': sig.dataId }),
      UnauthorizedException,
    );
  });

  it('rejects a webhook with a tampered signature', async () => {
    const svc = makeService({ MERCADOPAGO_WEBHOOK_SECRET: SECRET });
    const sig = buildSignature('100500');

    await assert.rejects(
      () => svc.handleWebhook('mercadopago', { status: 'approved' }, { 'x-signature': `ts=${sig.ts},v1=deadbeef` }, { 'data.id': sig.dataId }),
      UnauthorizedException,
    );
  });

  it('rejects a webhook without a signature header', async () => {
    const svc = makeService({ MERCADOPAGO_WEBHOOK_SECRET: SECRET });

    await assert.rejects(
      () => svc.handleWebhook('mercadopago', { status: 'approved' }, {}, { 'data.id': '100500' }),
      UnauthorizedException,
    );
  });

  it('rejects a webhook with a signature for a different data.id', async () => {
    const svc = makeService({ MERCADOPAGO_WEBHOOK_SECRET: SECRET });
    const sig = buildSignature('100500');

    await assert.rejects(
      () => svc.handleWebhook('mercadopago', { status: 'approved' }, { 'x-signature': sig.header }, { 'data.id': '999' }),
      UnauthorizedException,
    );
  });

  it('accepts a valid signature with the data.id nested by the express parser', async () => {
    const svc = makeService({ MERCADOPAGO_WEBHOOK_SECRET: SECRET });
    const sig = buildSignature('100500');

    const result = await svc.handleWebhook(
      'mercadopago',
      { status: 'approved' },
      { 'x-signature': sig.header },
      { data: { id: sig.dataId } },
    );

    assert.deepEqual(result, { provider: 'mercadopago', received: true, processed: true });
  });

  it('accepts a valid signature and reports it as processed when the payment is not approved', async () => {
    const svc = makeService({ MERCADOPAGO_WEBHOOK_SECRET: SECRET });
    const sig = buildSignature('100500');

    const result = await svc.handleWebhook(
      'mercadopago',
      { status: 'pending', external_reference: 'com-a_plan-x' },
      { 'x-signature': sig.header },
      { 'data.id': sig.dataId },
    );

    assert.deepEqual(result, { provider: 'mercadopago', received: true, processed: true });
  });

  it('accepts a valid signature and processes an approved payment', async () => {
    let planCalled = 0;
    const configService = { get: (key: string) => (key === 'MERCADOPAGO_WEBHOOK_SECRET' ? SECRET : null) } as any;
    const prisma = {
      payment: {
        findFirst: async () => null,
        create: async () => ({}),
      },
      plan: { findUnique: async () => { planCalled += 1; return null; } },
      company: { update: async () => ({}) },
    } as any;
    const svc = new PaymentsService(configService, prisma, {} as any, {} as any);
    const sig = buildSignature('100500');

    const result = await svc.handleWebhook(
      'mercadopago',
      { status: 'approved', external_reference: 'com-a_plan-x', id: 'pay-1' },
      { 'x-signature': sig.header },
      { 'data.id': sig.dataId },
    );

    assert.deepEqual(result, { provider: 'mercadopago', received: true, processed: true });
    assert.equal(planCalled, 1);
  });
});