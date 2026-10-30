import { validationProblem } from '../../core-crm/crm-problem-details';
import {
  CHANNEL_BODY_MAX_LENGTH,
  CHANNEL_EXTERNAL_ID_MAX_LENGTH,
  parseChannelBody,
  parseChannelExternalRef,
  parseChannelInboundEvent,
  parseChannelOccurredAt,
} from './inbox-channel.contracts';

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    externalMessageId: 'ext-1',
    senderExternalId: '+5511999999999',
    body: 'Olá, tudo bem?',
    occurredAt: '2026-10-29T09:00:00.000Z',
    ...overrides,
  };
}

describe('INBOX-03 channel inbound event contract', () => {
  it('parses a valid inbound event and normalizes occurredAt to ISO', () => {
    const event = parseChannelInboundEvent(validEvent());
    expect(event.externalMessageId).toBe('ext-1');
    expect(event.senderExternalId).toBe('+5511999999999');
    expect(event.body).toBe('Olá, tudo bem?');
    expect(event.occurredAt).toBe('2026-10-29T09:00:00.000Z');
  });

  it('omits occurredAt when the event does not carry one', () => {
    const event = parseChannelInboundEvent(
      validEvent({ occurredAt: undefined }),
    );
    expect(event.occurredAt).toBeUndefined();
  });

  it('rejects a non-object payload', () => {
    for (const bad of [null, undefined, 'string', 123, ['ext-1']]) {
      expect(() => parseChannelInboundEvent(bad)).toThrow(
        validationProblem([{ field: 'event', rule: 'invalid_value' }]),
      );
    }
  });

  it('rejects unknown fields so provider payloads cannot smuggle routing selectors', () => {
    for (const extra of [
      { ...validEvent(), tenantId: 'tenant-x' },
      { ...validEvent(), databaseName: 'sdb_x' },
      { ...validEvent(), channel: 'whatsapp' },
      { ...validEvent(), routingKey: 'r' },
    ]) {
      expect(() => parseChannelInboundEvent(extra)).toThrow(
        validationProblem([
          {
            field: Object.keys(extra).find(
              (k) =>
                k !== 'externalMessageId' &&
                k !== 'senderExternalId' &&
                k !== 'body' &&
                k !== 'occurredAt',
            )!,
            rule: 'unknown_field',
          },
        ]),
      );
    }
  });

  it('rejects missing or invalid identifier fields', () => {
    expect(() =>
      parseChannelInboundEvent(validEvent({ externalMessageId: undefined })),
    ).toThrow(
      validationProblem([{ field: 'externalMessageId', rule: 'required' }]),
    );
    expect(() =>
      parseChannelInboundEvent(validEvent({ senderExternalId: undefined })),
    ).toThrow(
      validationProblem([{ field: 'senderExternalId', rule: 'required' }]),
    );
    expect(() =>
      parseChannelInboundEvent(validEvent({ externalMessageId: 'x\u0000y' })),
    ).toThrow(
      validationProblem([
        { field: 'externalMessageId', rule: 'invalid_value' },
      ]),
    );
    expect(() =>
      parseChannelInboundEvent(validEvent({ senderExternalId: 'x\u0000y' })),
    ).toThrow(
      validationProblem([{ field: 'senderExternalId', rule: 'invalid_value' }]),
    );
    expect(() =>
      parseChannelInboundEvent(
        validEvent({
          externalMessageId: 'x'.repeat(CHANNEL_EXTERNAL_ID_MAX_LENGTH + 1),
        }),
      ),
    ).toThrow(
      validationProblem([
        { field: 'externalMessageId', rule: 'invalid_value' },
      ]),
    );
  });

  it('rejects an invalid or out-of-range occurredAt', () => {
    expect(() =>
      parseChannelInboundEvent(validEvent({ occurredAt: 'not-a-date' })),
    ).toThrow(
      validationProblem([{ field: 'occurredAt', rule: 'invalid_format' }]),
    );
    expect(() =>
      parseChannelInboundEvent(validEvent({ occurredAt: 123 })),
    ).toThrow(
      validationProblem([{ field: 'occurredAt', rule: 'invalid_value' }]),
    );
  });

  it('accepts multi-line bodies but rejects other control characters', () => {
    expect(parseChannelBody('linha um\nlinha dois\tabaixo', 'body')).toBe(
      'linha um\nlinha dois\tabaixo',
    );
    for (const bad of ['\x00', '\x01', '\x1b', '\x7f', '\x0b']) {
      expect(() => parseChannelBody(`texto${bad}fim`, 'body')).toThrow(
        validationProblem([{ field: 'body', rule: 'invalid_value' }]),
      );
    }
    expect(() => parseChannelBody('', 'body')).toThrow(
      validationProblem([{ field: 'body', rule: 'invalid_value' }]),
    );
    expect(() =>
      parseChannelBody('x'.repeat(CHANNEL_BODY_MAX_LENGTH + 1), 'body'),
    ).toThrow(validationProblem([{ field: 'body', rule: 'invalid_value' }]));
  });
});

describe('parseChannelExternalRef', () => {
  it('trims and accepts bounded identifier-like values', () => {
    expect(parseChannelExternalRef('  +5511999999999  ', 'ref')).toBe(
      '+5511999999999',
    );
  });

  it('rejects absent required, control characters, empty and oversize values', () => {
    expect(() => parseChannelExternalRef(undefined, 'ref')).toThrow(
      validationProblem([{ field: 'ref', rule: 'required' }]),
    );
    expect(() => parseChannelExternalRef('x\u0000y', 'ref')).toThrow(
      validationProblem([{ field: 'ref', rule: 'invalid_value' }]),
    );
    expect(() => parseChannelExternalRef('   ', 'ref')).toThrow(
      validationProblem([{ field: 'ref', rule: 'invalid_value' }]),
    );
    expect(() =>
      parseChannelExternalRef(
        'x'.repeat(CHANNEL_EXTERNAL_ID_MAX_LENGTH + 1),
        'ref',
      ),
    ).toThrow(validationProblem([{ field: 'ref', rule: 'invalid_value' }]));
  });

  it('returns undefined for an optional absent value', () => {
    expect(
      parseChannelExternalRef(undefined, 'ref', { required: false }),
    ).toBeUndefined();
  });
});

describe('parseChannelOccurredAt', () => {
  it('parses a valid ISO timestamp', () => {
    expect(
      parseChannelOccurredAt(
        '2026-10-29T09:00:00.000Z',
        'occurredAt',
      ).toISOString(),
    ).toBe('2026-10-29T09:00:00.000Z');
  });

  it('rejects a missing required timestamp and an unparseable one', () => {
    expect(() => parseChannelOccurredAt(undefined, 'occurredAt')).toThrow(
      validationProblem([{ field: 'occurredAt', rule: 'required' }]),
    );
    expect(() => parseChannelOccurredAt('not-a-date', 'occurredAt')).toThrow(
      validationProblem([{ field: 'occurredAt', rule: 'invalid_format' }]),
    );
  });
});
