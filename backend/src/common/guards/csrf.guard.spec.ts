import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

function makeContext(method: string, contentType?: string) {
  const guard = new CsrfGuard();
  const request = { method, headers: { 'content-type': contentType } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
  return { guard, context };
}

describe('CsrfGuard', () => {
  it('allows GET requests', () => {
    const { guard, context } = makeContext('GET');
    assert.equal(guard.canActivate(context), true);
  });

  it('allows HEAD and OPTIONS', () => {
    assert.equal(makeContext('HEAD').guard.canActivate(makeContext('HEAD').context), true);
    assert.equal(makeContext('OPTIONS').guard.canActivate(makeContext('OPTIONS').context), true);
  });

  it('allows mutation requests with Content-Type application/json', () => {
    const { guard, context } = makeContext('POST', 'application/json');
    assert.equal(guard.canActivate(context), true);
  });

  it('allows application/json with charset suffix', () => {
    const { guard, context } = makeContext('POST', 'application/json; charset=utf-8');
    assert.equal(guard.canActivate(context), true);
  });

  it('forbids mutation requests without application/json', () => {
    const { guard, context } = makeContext('POST', 'application/x-www-form-urlencoded');
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });

  it('forbids mutation requests without Content-Type', () => {
    const { guard, context } = makeContext('POST', undefined);
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });
});