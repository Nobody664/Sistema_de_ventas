import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';
import { CheckoutRequestsController } from './checkout-requests.controller';

describe('CheckoutRequestsController auth handling', () => {
  const received: any = {};
  const service = {
    createRequest: async (input: any) => {
      received.create = input;
      return { requestId: 'req-1' };
    },
    submitProof: async (requestId: string, companyId?: string, body?: any) => {
      received.proof = { requestId, companyId, body };
      return { ok: true };
    },
    review: async (requestId: string, reviewerId: string, body?: any) => {
      received.review = { requestId, reviewerId, body };
      return { ok: true };
    },
  } as any;
  const controller = new CheckoutRequestsController(service);

  it('rejects a guest sending a companyId in the body (spoofed)', async () => {
    await assert.rejects(
      async () => controller.create(null, { companyId: 'com-evil' } as any),
      (err: any) => err instanceof UnauthorizedException,
    );
  });

  it('injects the session companyId for authenticated members', async () => {
    const body = {
      planCode: 'BASICO',
      paymentMethod: 'YAPE',
      fullName: 'Juan Perez',
      companyName: 'Mi Empresa',
      email: 'juan@mail.com',
      password: 'secret123',
    } as any;

    await controller.create(
      { sub: 'u1', companyId: 'com-a', roles: ['ADMIN'] } as any,
      body,
    );

    assert.equal(received.create.companyId, 'com-a');
    assert.equal(received.create.planCode, 'BASICO');
    assert.equal(received.create.paymentMethod, 'YAPE');
  });

  it('keeps companyId undefined for guests', async () => {
    await controller.create(null, {
      planCode: 'BASICO',
      paymentMethod: 'PLIN',
      fullName: 'Guest',
      companyName: 'Guest Co',
      email: 'guest@mail.com',
      password: 'secret123',
    } as any);

    assert.equal(received.create.companyId, undefined);
  });

  it('scopes proof submissions to the session company', async () => {
    await controller.submitProof(
      { sub: 'u1', companyId: 'com-a' } as any,
      'req-1',
      { paymentDate: new Date().toISOString() } as any,
    );

    assert.equal(received.proof.requestId, 'req-1');
    assert.equal(received.proof.companyId, 'com-a');
  });

  it('passes the reviewer id (sub) to review', async () => {
    await controller.review(
      'req-1',
      { sub: 'u-admin', companyId: 'com-a', roles: ['SUPER_ADMIN'] } as any,
      { status: 'APPROVED' } as any,
    );

    assert.equal(received.review.reviewerId, 'u-admin');
  });
});