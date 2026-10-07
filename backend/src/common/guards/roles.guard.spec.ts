import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function makeContext(user: { roles?: string[] }, requiredRoles?: string[]) {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as any;
  const guard = new RolesGuard(reflector);
  const request = { user };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
  return { guard, context };
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const { guard, context } = makeContext({ roles: ['CASHIER'] });
    assert.equal(guard.canActivate(context), true);
  });

  it('allows a member with a matching role', () => {
    const { guard, context } = makeContext(
      { roles: ['COMPANY_ADMIN'] },
      ['COMPANY_ADMIN', 'MANAGER'],
    );
    assert.equal(guard.canActivate(context), true);
  });

  it('forbids a member without the required role', () => {
    const { guard, context } = makeContext({ roles: ['CASHIER'] }, ['COMPANY_ADMIN']);
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });

  it('always allows SUPER_ADMIN regardless of the required roles', () => {
    const { guard, context } = makeContext({ roles: ['SUPER_ADMIN'] }, ['COMPANY_ADMIN']);
    assert.equal(guard.canActivate(context), true);
  });

  it('forbids an unauthenticated request that declares a protected route', () => {
    const { guard, context } = makeContext({}, ['COMPANY_ADMIN']);
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });
});