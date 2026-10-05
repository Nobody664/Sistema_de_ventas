import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/client';
import type { Request, Response } from 'express';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
  path: string;
  timestamp: string;
};

/**
 * Errores de Prisma que representan una condicion esperada del cliente, no un
 * fallo del servidor. Sin este mapeo todos llegan como 500.
 */
const PRISMA_KNOWN_ERRORS: Record<string, { status: number; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'El valor excede el tamano permitido' },
  P2002: { status: HttpStatus.CONFLICT, message: 'Ya existe un registro con esos datos' },
  P2003: {
    status: HttpStatus.CONFLICT,
    message: 'Operacion invalida: el registro hace referencia a datos inexistentes',
  },
  P2011: { status: HttpStatus.BAD_REQUEST, message: 'No se puede filtrar por ese campo' },
  P2014: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Operacion invalida: falta una relacion requerida',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Recurso no encontrado' },
  P2034: { status: HttpStatus.CONFLICT, message: 'Conflicto de transaccion, reintenta' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolve(exception);
    const body: ErrorBody = {
      statusCode: resolved.status,
      message: resolved.message,
      error: resolved.error,
      code: resolved.code,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    };

    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${body.path} -> ${resolved.status} ${String(resolved.message)}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${body.path} -> ${resolved.status} ${String(resolved.message)}`);
    }

    response.status(resolved.status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
    error?: string;
    code?: string;
  } {
    if (exception instanceof PrismaClientKnownRequestError) {
      const mapped = PRISMA_KNOWN_ERRORS[exception.code];
      return {
        status: mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        message: mapped?.message ?? 'Error de base de datos',
        code: exception.code,
      };
    }

    if (exception instanceof PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'La consulta enviada no es valida',
        code: 'PRISMA_VALIDATION',
      };
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (exception instanceof Error) {
      const isProduction = process.env.NODE_ENV === 'production';
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: isProduction ? 'Error interno del servidor' : exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    };
  }

  private resolveHttpException(exception: HttpException): {
    status: number;
    message: string | string[];
    error?: string;
    code?: string;
  } {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const fallback = 'Error interno del servidor';

    if (typeof payload === 'string') {
      return { status, message: payload };
    }

    if (typeof payload !== 'object' || payload === null) {
      return { status, message: fallback };
    }

    const obj = payload as Record<string, unknown>;
    const rawMessage = obj.message;

    // ValidationPipe devuelve un array de strings; se preserva tal cual.
    const message = Array.isArray(rawMessage)
      ? (rawMessage as string[])
      : typeof rawMessage === 'string'
        ? rawMessage
        : fallback;

    return {
      status,
      message,
      error: typeof obj.error === 'string' ? obj.error : undefined,
      code: typeof obj.code === 'string' ? obj.code : undefined,
    };
  }
}