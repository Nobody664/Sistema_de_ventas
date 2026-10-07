import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard.handleRequest', () => {
  const guard = new OptionalJwtAuthGuard() as any;

  it('returns the user when a valid session exists', () => {
    const user = { sub: 'u1', companyId: 'com-a' };
    assert.equal(guard.handleRequest(null, user, null, null), user);
  });

  it('returns null instead of throwing when there is no session', () => {
    assert.equal(guard.handleRequest(null, null, null, null), null);
  });

  it('ignores authentication errors as guests', () => {
    const error = new Error('Rejected');
    assert.equal(guard.handleRequest(error, null, null, null), null);
  });
});