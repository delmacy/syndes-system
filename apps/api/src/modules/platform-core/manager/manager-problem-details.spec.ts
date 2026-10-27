import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import {
  ManagerProblemDetailsFilter,
  ManagerProblemException,
} from './manager-problem-details';

interface CapturedResponse {
  status: number;
  contentType?: string;
  body?: unknown;
  requestIdHeader?: string;
}

function respond(): {
  captured: CapturedResponse;
  host: ArgumentsHost;
} {
  const captured: CapturedResponse = { status: 0 };
  const response = {
    setHeader: (name: string, value: string) => {
      if (name === 'content-type') captured.contentType = value;
      else captured.requestIdHeader = value;
    },
    status: (code: number) => {
      captured.status = code;
      return response;
    },
    json: (body: unknown) => {
      captured.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { captured, host };
}

describe('manager problem details (RFC 9457)', () => {
  const filter = new ManagerProblemDetailsFilter();

  function toBody(captured: CapturedResponse): {
    type: string;
    title: string;
    status: number;
    code: string;
    requestId: string;
    detail?: string;
    errors?: { field: string; rule: string }[];
  } {
    return captured.body as never;
  }

  it('renders manager problem payloads with stable code and requestId', () => {
    const { captured, host } = respond();
    const error = new ManagerProblemException({
      code: 'validation_failed',
      statusCode: HttpStatus.BAD_REQUEST,
      detail: 'displayName is required.',
      errors: [{ field: 'displayName', rule: 'required' }],
    });
    filter.catch(error, host);

    expect(captured.status).toBe(400);
    expect(captured.contentType).toBe(
      'application/problem+json; charset=utf-8',
    );
    const body = toBody(captured);
    expect(body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'validation_failed',
      detail: 'displayName is required.',
      errors: [{ field: 'displayName', rule: 'required' }],
    });
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('sanitizes authentication guard exceptions to static problem bodies', () => {
    const unauthorized = respond();
    filter.catch(
      new UnauthorizedException('Invalid bearer token'),
      unauthorized.host,
    );
    const forbidden = respond();
    filter.catch(
      new ForbiddenException('Platform administrator MFA is required'),
      forbidden.host,
    );
    const badRequest = respond();
    filter.catch(
      new BadRequestException(['some internal detail']),
      badRequest.host,
    );

    expect(unauthorized.captured.status).toBe(401);
    expect(toBody(unauthorized.captured)).toMatchObject({
      status: 401,
      code: 'unauthorized',
      title: 'Unauthorized',
    });
    expect(forbidden.captured.status).toBe(403);
    expect(forbidden.captured.body).not.toHaveProperty('detail');
    expect(JSON.stringify(forbidden.captured.body)).not.toContain('MFA');
    expect(badRequest.captured.status).toBe(400);
    expect(JSON.stringify(badRequest.captured.body)).not.toContain(
      'some internal detail',
    );
  });

  it('never exposes unexpected errors, stacks, or connection strings', () => {
    const { captured, host } = respond();
    const leaking = new Error(
      'failed admin:topsecret@localhost:5432/control_plane password tok_val',
    );
    (leaking as NodeJS.ErrnoException).stack = 'secret stack';
    filter.catch(leaking, host);

    expect(captured.status).toBe(500);
    const body = toBody(captured);
    expect(body).toMatchObject({
      status: 500,
      code: 'internal_error',
      title: 'Internal Server Error',
    });
    expect(JSON.stringify(body)).not.toContain('topsecret');
    expect(JSON.stringify(body)).not.toContain('tok_val');
    expect(JSON.stringify(body)).not.toContain('secret stack');
    expect(body).not.toHaveProperty('detail');
  });
});
