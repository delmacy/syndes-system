import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

export interface ProblemDetailsFieldError {
  field: string;
  rule: string;
}

export interface ManagerProblemPayload {
  code: string;
  detail?: string;
  statusCode?: HttpStatus;
  errors?: ProblemDetailsFieldError[];
  extra?: Record<string, string>;
}

/**
 * Thrown by Platform Core manager surfaces (CRM-04). Carries a stable problem
 * code plus safe detail text and field errors; values must never contain
 * secrets, connection strings, stack traces, or tenant CRM content.
 */
export class ManagerProblemException extends HttpException {
  constructor(private readonly payload: ManagerProblemPayload) {
    super(payload, payload.statusCode ?? HttpStatus.BAD_REQUEST);
    this.message = payload.detail ?? payload.code;
  }
}

export function managerExceptionPayload(
  exception: HttpException,
): ManagerProblemPayload | null {
  const response = exception.getResponse();
  if (
    typeof response === 'object' &&
    response !== null &&
    isSafePayloadShape(response)
  ) {
    return response as ManagerProblemPayload;
  }
  return null;
}

function isSafePayloadShape(value: object): boolean {
  if (
    !('code' in value) ||
    typeof value.code !== 'string' ||
    !/^[a-z][a-z0-9_.]{0,99}$/.test(value.code)
  ) {
    return false;
  }
  const errors = 'errors' in value ? value.errors : undefined;
  if (errors === undefined) return true;
  if (!Array.isArray(errors)) return false;
  return errors.every(
    (item): boolean =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).field === 'string' &&
      typeof (item as Record<string, unknown>).rule === 'string',
  );
}

interface ProblemDetailsBody {
  type: string;
  title: string;
  status: number;
  code: string;
  requestId: string;
  detail?: string;
  errors?: ProblemDetailsFieldError[];
  [key: string]: unknown;
}

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
};

/**
 * RFC 9457 Problem Details renderer (CRM-00/CRM-04). Every manager error is
 * `application/problem+json` with a stable `code` and a fresh `requestId`;
 * unknown-origin errors are reduced to a static status title so stack
 * traces, credentials, connection strings, and internal messages never reach
 * the client or the audit trail.
 */
@Catch()
export class ManagerProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ManagerProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = randomUUID();
    response.setHeader('x-request-id', requestId);
    response.status(this.statusFor(exception));
    response.setHeader(
      'content-type',
      'application/problem+json; charset=utf-8',
    );
    response.json(this.bodyFor(exception, requestId));
  }

  private statusFor(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    this.logger.error(
      `Unhandled manager API error (${exception instanceof Error ? exception.name : typeof exception}).`,
    );
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private bodyFor(exception: unknown, requestId: string): ProblemDetailsBody {
    if (exception instanceof HttpException) {
      const payload = managerExceptionPayload(exception);
      if (payload) {
        return {
          type: 'about:blank',
          title:
            STATUS_TITLES[payload.statusCode ?? exception.getStatus()] ??
            STATUS_TITLES[500],
          status: payload.statusCode ?? exception.getStatus(),
          code: payload.code,
          requestId,
          ...(payload.detail ? { detail: payload.detail } : {}),
          ...(payload.errors?.length ? { errors: payload.errors } : {}),
          ...(payload.extra ?? {}),
        };
      }
      const status = exception.getStatus();
      return {
        type: 'about:blank',
        title: STATUS_TITLES[status] ?? STATUS_TITLES[500],
        status,
        code: STATUS_CODES_BY_HTTP[status] ?? 'internal_error',
        requestId,
      };
    }
    return {
      type: 'about:blank',
      title: STATUS_TITLES[500],
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      requestId,
    };
  }
}

const STATUS_CODES_BY_HTTP: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  500: 'internal_error',
  502: 'provisioning_failed',
};

export const MANAGER_PROBLEM_DETAILS_FILTER = {
  provide: APP_FILTER,
  useClass: ManagerProblemDetailsFilter,
} as const;
