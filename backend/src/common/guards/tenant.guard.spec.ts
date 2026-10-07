import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

function makeGuard(companyStatus?: string) {
  const prisma = {
    company: {
      findUnique: async () => ({ status: companyStatus ?? 'ACTIVE' }),
    },
  } as any;
  const reflector = { getAllAndOverride: () => undefined } as any;
  return new TenantGuard(reflector, prisma);
}

interface FakeRequest {
  user?: { companyId?: string | null; roles?: string[]; companyStatus?: string };
  tenantId?: string;
}

function makeContext(request: FakeRequest) {
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
  return context;
}

describe('TenantGuard', () => {
  it('rejects a global admin without companyId (no "all tenants" fallback)', async () => {
    const guard = makeGuard();
    const request: FakeRequest = { user: { roles: ['SUPER_ADMIN'] } };
    await assert.rejects(
      () => guard.canActivate(makeContext(request)),
      ForbiddenException,
    );
    assert.equal(request.tenantId, undefined);
  });

  it('allows a global admin with companyId and scopes the request', async () => {
    const guard = makeGuard();
    const request: FakeRequest = {
      user: { companyId: 'com-a', roles: ['SUPER_ADMIN'] },
    };
    assert.equal(await guard.canActivate(makeContext(request)), true);
    assert.equal(request.tenantId, 'com-a');
  });

  it('rejects a non-admin member without companyId', async () => {
    const guard = makeGuard();
    const request: FakeRequest = { user: { roles: ['ADMIN'] } };
    await assert.rejects(
      () => guard.canActivate(makeContext(request)),
      ForbiddenException,
    );
  });

  it('scopes a member to its company', async () => {
    const guard = makeGuard('ACTIVE');
    const request: FakeRequest = {
      user: { companyId: 'com-a', roles: ['ADMIN'], companyStatus: 'ACTIVE' },
    };
    assert.equal(await guard.canActivate(makeContext(request)), true);
    assert.equal(request.tenantId, 'com-a');
  });

  it('blocks members of suspended companies', async () => {
    const guard = makeGuard('SUSPENDED');
    const request: FakeRequest = {
      user: { companyId: 'com-a', roles: ['ADMIN'] },
    };
    await assert.rejects(
      () => guard.canActivate(makeContext(request)),
      ForbiddenException,
    );
  });
});