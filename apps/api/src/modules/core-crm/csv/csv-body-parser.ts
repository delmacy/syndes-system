import { randomUUID } from 'node:crypto';
import { raw, type ErrorRequestHandler, type RequestHandler } from 'express';
import { MAX_CSV_BYTES } from './csv-parser';

export const CSV_CONTENT_TYPE = 'text/csv';
export const CSV_TOO_LARGE_CODE = 'csv_too_large';

interface CsvBodyParserTarget {
  use(...handlers: unknown[]): unknown;
}

/**
 * CRM-08 HTTP boundary for `text/csv`. The request body is kept as raw bytes
 * so the CSV parser can decode it with a fatal UTF-8 decoder: a malformed byte
 * sequence is a client error instead of silently repaired text. The transport
 * limit is the same 10 MiB bound the parser enforces.
 */
export function csvBodyParser(): RequestHandler {
  return raw({ type: CSV_CONTENT_TYPE, limit: MAX_CSV_BYTES });
}

/**
 * Maps the transport-level over-limit rejection to the stable, PII-free
 * `csv_too_large` problem body with HTTP 413. The body parser rejects before
 * the request reaches the CRM service, so the limit is enforced here instead of
 * being reported as an unhandled server error.
 */
export function csvPayloadErrorHandler(): ErrorRequestHandler {
  return (error, _request, response, next) => {
    if (!isPayloadTooLarge(error)) {
      next(error);
      return;
    }
    const requestId = randomUUID();
    response.status(413);
    response.setHeader('x-request-id', requestId);
    response.setHeader(
      'content-type',
      'application/problem+json; charset=utf-8',
    );
    response.json({
      type: 'about:blank',
      title: 'Payload Too Large',
      status: 413,
      code: CSV_TOO_LARGE_CODE,
      requestId,
      detail: 'CSV payload exceeds the 10 MiB limit.',
    });
  };
}

/**
 * Registers the CSV body parser and its limit handler. Must be installed
 * before the application router so an over-limit body is answered by the
 * stable `csv_too_large` contract.
 */
export function registerCsvBodyParser(app: CsvBodyParserTarget): void {
  app.use(csvBodyParser());
  app.use(csvPayloadErrorHandler());
}

function isPayloadTooLarge(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as {
    type?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return (
    candidate.type === 'entity.too.large' ||
    candidate.status === 413 ||
    candidate.statusCode === 413
  );
}
