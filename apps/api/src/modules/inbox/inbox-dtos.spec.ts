import { HttpStatus } from '@nestjs/common';
import { CrmProblemException } from '../core-crm/crm-problem-details';
import {
  INBOX_BODY_MAX_LENGTH,
  parseCreateInboxMessageDto,
  parseCreateInboxNoteDto,
  parseIdempotencyKeyHeader,
  parseInboxAssignmentUpdateDto,
  parseInboxListQuery,
  parseInboxMessageListQuery,
  parseInboxStatusUpdateDto,
} from './inbox-dtos';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

function problemOf(run: () => unknown): CrmProblemException {
  try {
    run();
  } catch (error) {
    if (error instanceof CrmProblemException) return error;
    throw error;
  }
  throw new Error('Expected a CrmProblemException');
}

function problemBody(error: CrmProblemException): {
  code: string;
  statusCode?: number;
  errors?: { field: string; rule: string }[];
} {
  return error.getResponse() as {
    code: string;
    statusCode?: number;
    errors?: { field: string; rule: string }[];
  };
}

describe('INBOX-02 HTTP DTO validation', () => {
  describe('parseInboxListQuery', () => {
    it('defaults to page 1 and 20 items with no filters', () => {
      expect(parseInboxListQuery({})).toEqual({ page: 1, pageSize: 20 });
    });

    it('accepts every frozen filter and normalizes the assignee uuid', () => {
      expect(
        parseInboxListQuery({
          status: 'pending',
          assignee: ACTOR_ID.toUpperCase(),
          channel: 'whatsapp',
          page: '2',
          pageSize: '50',
        }),
      ).toEqual({
        status: 'pending',
        assignee: ACTOR_ID,
        channel: 'whatsapp',
        page: 2,
        pageSize: 50,
      });
    });

    it('treats empty filter values as absent', () => {
      expect(
        parseInboxListQuery({ status: '', assignee: '', channel: '' }),
      ).toEqual({ page: 1, pageSize: 20 });
    });

    it('rejects an unknown filter, an unknown status and an unknown channel', () => {
      const unknown = problemOf(() => parseInboxListQuery({ q: 'ana' }));
      expect(problemBody(unknown).errors).toEqual([
        { field: 'q', rule: 'unknown_field' },
      ]);
      const status = problemOf(() => parseInboxListQuery({ status: 'closed' }));
      expect(problemBody(status).errors).toContainEqual({
        field: 'status',
        rule: 'invalid_value',
      });
      const channel = problemOf(() => parseInboxListQuery({ channel: 'sms' }));
      expect(problemBody(channel).errors).toContainEqual({
        field: 'channel',
        rule: 'invalid_value',
      });
    });

    it('rejects a non-uuid assignee and applies the pageSize limit', () => {
      const assignee = problemOf(() =>
        parseInboxListQuery({ assignee: 'someone' }),
      );
      expect(problemBody(assignee).errors).toEqual([
        { field: 'assignee', rule: 'invalid_format' },
      ]);
      const page = problemOf(() => parseInboxListQuery({ page: '0' }));
      expect(problemBody(page).errors).toEqual([
        { field: 'page', rule: 'invalid_value' },
      ]);
      const pageSize = problemOf(() =>
        parseInboxListQuery({ pageSize: '101' }),
      );
      expect(problemBody(pageSize).errors).toEqual([
        { field: 'pageSize', rule: 'exceeds_limit' },
      ]);
    });

    it('never lets the client name a tenant or database', () => {
      for (const field of ['tenantId', 'tenant_id', 'databaseName']) {
        const error = problemOf(() =>
          parseInboxListQuery({ [field]: 'attacker' }),
        );
        expect(problemBody(error).errors).toEqual([
          { field, rule: 'unknown_field' },
        ]);
      }
    });
  });

  describe('parseInboxMessageListQuery', () => {
    it('defaults the limit and accepts a valid cursor', () => {
      expect(parseInboxMessageListQuery({})).toEqual({ limit: 50 });
      expect(
        parseInboxMessageListQuery({ after: CONVERSATION_ID, limit: '200' }),
      ).toEqual({ after: CONVERSATION_ID, limit: 200 });
    });

    it('rejects a malformed cursor, a non-positive limit and the hard cap', () => {
      const cursor = problemOf(() =>
        parseInboxMessageListQuery({ after: 'last' }),
      );
      expect(problemBody(cursor).errors).toEqual([
        { field: 'after', rule: 'invalid_format' },
      ]);
      const limit = problemOf(() => parseInboxMessageListQuery({ limit: '0' }));
      expect(problemBody(limit).errors).toEqual([
        { field: 'limit', rule: 'invalid_value' },
      ]);
      const capped = problemOf(() =>
        parseInboxMessageListQuery({ limit: '201' }),
      );
      expect(problemBody(capped).errors).toEqual([
        { field: 'limit', rule: 'exceeds_limit' },
      ]);
    });
  });

  describe('parseCreateInboxMessageDto / parseCreateInboxNoteDto', () => {
    it('accepts a bounded body verbatim, including line breaks and spaces', () => {
      const body = '  primeira linha\nsegunda linha  ';
      expect(parseCreateInboxMessageDto({ body })).toEqual({ body });
      expect(parseCreateInboxNoteDto({ body })).toEqual({ body });
    });

    it('rejects empty, oversized, control-character and unknown-field bodies', () => {
      const empty = problemOf(() => parseCreateInboxMessageDto({ body: '' }));
      expect(problemBody(empty).errors).toEqual([
        { field: 'body', rule: 'invalid_value' },
      ]);
      const oversized = problemOf(() =>
        parseCreateInboxMessageDto({
          body: 'x'.repeat(INBOX_BODY_MAX_LENGTH + 1),
        }),
      );
      expect(problemBody(oversized).errors).toEqual([
        { field: 'body', rule: 'invalid_value' },
      ]);
      const control = problemOf(() =>
        parseCreateInboxNoteDto({ body: 'nota\u0000oculta' }),
      );
      expect(problemBody(control).errors).toEqual([
        { field: 'body', rule: 'invalid_value' },
      ]);
      const extra = problemOf(() =>
        parseCreateInboxNoteDto({ body: 'ok', tenantId: 't' }),
      );
      expect(problemBody(extra).errors).toEqual([
        { field: 'tenantId', rule: 'unknown_field' },
      ]);
    });

    it('rejects a non-object payload', () => {
      for (const value of [null, 'body', 1, []]) {
        const error = problemOf(() => parseCreateInboxNoteDto(value));
        expect(problemBody(error).code).toBe('validation_failed');
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });
  });

  describe('parseIdempotencyKeyHeader', () => {
    it('requires a non-empty bounded key and trims it', () => {
      expect(parseIdempotencyKeyHeader(`  key-${CONVERSATION_ID}  `)).toBe(
        `key-${CONVERSATION_ID}`,
      );
      const missing = problemOf(() => parseIdempotencyKeyHeader(undefined));
      expect(problemBody(missing).errors).toEqual([
        { field: 'Idempotency-Key', rule: 'required' },
      ]);
      const blank = problemOf(() => parseIdempotencyKeyHeader('   '));
      expect(problemBody(blank).errors).toEqual([
        { field: 'Idempotency-Key', rule: 'required' },
      ]);
      const long = problemOf(() => parseIdempotencyKeyHeader('k'.repeat(201)));
      expect(problemBody(long).errors).toEqual([
        { field: 'Idempotency-Key', rule: 'exceeds_limit' },
      ]);
    });
  });

  describe('parseInboxAssignmentUpdateDto', () => {
    it('accepts null (release) and a uuid (assign)', () => {
      expect(parseInboxAssignmentUpdateDto({ assigneeActorId: null })).toEqual({
        assigneeActorId: null,
      });
      expect(
        parseInboxAssignmentUpdateDto({
          assigneeActorId: ACTOR_ID.toUpperCase(),
        }),
      ).toEqual({ assigneeActorId: ACTOR_ID });
    });

    it('requires the field and rejects malformed or non-string targets', () => {
      const missing = problemOf(() => parseInboxAssignmentUpdateDto({}));
      expect(problemBody(missing).errors).toEqual([
        { field: 'assigneeActorId', rule: 'required' },
      ]);
      const malformed = problemOf(() =>
        parseInboxAssignmentUpdateDto({ assigneeActorId: 'me' }),
      );
      expect(problemBody(malformed).errors).toEqual([
        { field: 'assigneeActorId', rule: 'invalid_format' },
      ]);
      const number = problemOf(() =>
        parseInboxAssignmentUpdateDto({ assigneeActorId: 7 }),
      );
      expect(problemBody(number).errors).toEqual([
        { field: 'assigneeActorId', rule: 'invalid_value' },
      ]);
    });
  });

  describe('parseInboxStatusUpdateDto', () => {
    it('accepts only open, pending and resolved', () => {
      for (const status of ['open', 'pending', 'resolved']) {
        expect(parseInboxStatusUpdateDto({ status })).toEqual({ status });
      }
      const invalid = problemOf(() =>
        parseInboxStatusUpdateDto({ status: 'closed' }),
      );
      expect(invalid.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(problemBody(invalid).errors).toContainEqual({
        field: 'status',
        rule: 'invalid_value',
      });
      const missing = problemOf(() => parseInboxStatusUpdateDto({}));
      expect(problemBody(missing).errors).toEqual([
        { field: 'status', rule: 'required' },
      ]);
    });
  });

  it('maps every validation problem to 400', () => {
    const error = problemOf(() => parseInboxListQuery({ pageSize: '0' }));
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });
});
