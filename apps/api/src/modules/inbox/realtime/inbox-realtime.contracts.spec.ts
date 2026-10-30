import { validationProblem } from '../../core-crm/crm-problem-details';
import { UUID_PATTERN } from '../../core-crm/crm-dtos';
import {
  createInboxRealtimeEvent,
  INBOX_REALTIME_PATH,
  INBOX_REALTIME_HEARTBEAT,
  INBOX_REALTIME_REVOKED,
} from './inbox-realtime.contracts';
import { parseInboxRealtimeQuery } from './inbox-realtime.dto';

describe('INBOX-04 realtime query parsing', () => {
  const validUuid = '11111111-1111-4111-8111-111111111111';

  it('parses repeated conversationIds, deduplicates (case-insensitive) and sorts', () => {
    const query = parseInboxRealtimeQuery({
      conversationId: [
        'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
      ],
    });
    expect(query.conversationIds).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
  });

  it('accepts a single conversationId or none', () => {
    expect(
      parseInboxRealtimeQuery({ conversationId: validUuid }).conversationIds,
    ).toEqual([validUuid]);
    expect(parseInboxRealtimeQuery({}).conversationIds).toEqual([]);
    expect(
      parseInboxRealtimeQuery({ conversationId: '' }).conversationIds,
    ).toEqual([]);
  });

  it('rejects unknown fields, non-UUID values and too many ids', () => {
    expect(() =>
      parseInboxRealtimeQuery({ conversationId: 'x', tenant: 't' }),
    ).toThrow(validationProblem([{ field: 'tenant', rule: 'unknown_field' }]));
    expect(() =>
      parseInboxRealtimeQuery({ conversationId: 'not-a-uuid' }),
    ).toThrow(
      validationProblem([{ field: 'conversationId', rule: 'invalid_format' }]),
    );
    const many = Array.from(
      { length: 51 },
      (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
    );
    expect(() => parseInboxRealtimeQuery({ conversationId: many })).toThrow(
      validationProblem([{ field: 'conversationId', rule: 'exceeds_limit' }]),
    );
  });

  it('validates each id against the UUID pattern', () => {
    const bad = 'not-a-uuid';
    expect(() => parseInboxRealtimeQuery({ conversationId: [bad] })).toThrow(
      validationProblem([{ field: 'conversationId', rule: 'invalid_format' }]),
    );
    const good = '11111111-1111-4111-8111-111111111111';
    expect(UUID_PATTERN.test(good)).toBe(true);
  });
});

describe('createInboxRealtimeEvent', () => {
  it('builds a pointer event with a fresh id and ISO timestamp', () => {
    const event = createInboxRealtimeEvent('inbox.message.created', 'conv-1', {
      messageId: 'm-1',
    });
    expect(event.type).toBe('inbox.message.created');
    expect(event.conversationId).toBe('conv-1');
    expect(event.payload).toEqual({ messageId: 'm-1' });
    expect(typeof event.id).toBe('string');
    expect(event.id.length).toBeGreaterThan(0);
    expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
  });

  it('uses the supplied occurredAt when provided', () => {
    const occurredAt = new Date('2026-10-29T09:00:00.000Z');
    const event = createInboxRealtimeEvent(
      'inbox.note.created',
      'conv-1',
      { noteId: 'n-1' },
      occurredAt,
    );
    expect(event.occurredAt).toBe('2026-10-29T09:00:00.000Z');
  });
});

describe('realtime constants', () => {
  it('exposes the fixed path and transport event names', () => {
    expect(INBOX_REALTIME_PATH).toBe('/api/v1/inbox/realtime');
    expect(INBOX_REALTIME_HEARTBEAT).toBe('inbox.realtime.heartbeat');
    expect(INBOX_REALTIME_REVOKED).toBe('inbox.realtime.revoked');
  });
});
