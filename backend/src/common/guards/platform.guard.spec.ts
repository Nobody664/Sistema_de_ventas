import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { PlatformGuard } from './platform.guard';

interface FakeRequest {
  user?: { companyId?: string | null; roles?: string[] };
}

function makeContext(request: FakeRequest) {
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
  return context;
}

describe('PlatformGuard', () => {
  it('rejects a tenant-context user (COMPANY_ADMIN) even with a companyId', () => {
    const guard = new PlatformGuard();
    const request: FakeRequest = {
      user: { companyId: 'com-a', roles: ['USER', 'COMPANY_ADMIN'] },
    };
    assert.throws(() => guard.canActivate(makeContext(request)), ForbiddenException);
  });

  it('rejects a request without an authenticated user', () => {
    const guard = new PlatformGuard();
    assert.throws(() => guard.canActivate(makeContext({})), ForbiddenException);
  });

  it('allows a SUPER_ADMIN with tenant context', () => {
    const guard = new PlatformGuard();
    const request: FakeRequest = {
      user: { companyId: 'com-a', roles: ['USER', 'SUPER_ADMIN'] },
    };
    assert.equal(guard.canActivate(makeContext(request)), true);
  });

  it('allows a SUPPORT_ADMIN without tenant context', () => {
    const guard = new PlatformGuard();
    const request: FakeRequest = { user: { roles: ['SUPPORT_ADMIN'] } };
    assert.equal(guard.canActivate(makeContext(request)), true);
  });
});
