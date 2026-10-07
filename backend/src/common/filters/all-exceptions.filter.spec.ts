import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeContext() {
  const response = {
    statusCode: 0,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const request = { method: 'POST', url: '/test', originalUrl: '/test' };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as any;
  return { response, context };
}

describe('AllExceptionsFilter', () => {
  it('mapea Prisma P2002 a 409 y expone el campo duplicado en el mensaje', () => {
    const filter = new AllExceptionsFilter();
    const { response, context } = makeContext();
    const err = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target: ['idempotencyKey'] },
    });

    filter.catch(err, context);

    assert.equal(response.statusCode, HttpStatus.CONFLICT);
    assert.equal(response.body.statusCode, HttpStatus.CONFLICT);
    assert.equal(response.body.code, 'P2002');
    assert.match(response.body.message, /idempotencyKey/);
  });

  it('mapea P2002 a 409 con mensaje generico cuando no hay target', () => {
    const filter = new AllExceptionsFilter();
    const { response, context } = makeContext();
    const err = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });

    filter.catch(err, context);

    assert.equal(response.statusCode, HttpStatus.CONFLICT);
    assert.equal(response.body.message, 'Ya existe un registro con esos datos');
  });

  it('mapea Prisma P2025 a 404', () => {
    const filter = new AllExceptionsFilter();
    const { response, context } = makeContext();
    const err = new PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });

    filter.catch(err, context);

    assert.equal(response.statusCode, HttpStatus.NOT_FOUND);
    assert.equal(response.body.message, 'Recurso no encontrado');
  });
});