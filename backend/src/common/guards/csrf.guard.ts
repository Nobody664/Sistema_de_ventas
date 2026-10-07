import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const contentType = (request.headers['content-type'] as string | undefined) ?? '';
    if (contentType.toLowerCase().startsWith('application/json')) {
      return true;
    }

    throw new ForbiddenException(
      'Operación rechazada (protección CSRF): se requiere Content-Type: application/json',
    );
  }
}