import { validationProblem } from '../../core-crm/crm-problem-details';
import type { InboxChannel } from '../inbox-dtos';

/**
 * INBOX-03 typed port between Inbox and any channel provider.
 *
 * Channel adapters (the deterministic fake today; PRD-003 WhatsApp/e-mail
 * later) implement `ChannelPort` for outbound dispatch, and submit inbound
 * events to `InboxInboundService`. Nothing here knows a provider SDK,
 * transport or network address.
 *
 * Tenancy is never part of the channel payload: inbound events are parsed
 * with an allowlist that excludes `tenantId`, `databaseName` and every
 * other routing selector. Tenant and tenant database come exclusively from
 * the trusted `TenantContext` the caller already resolved server-side.
 */

export type InboxProductChannel = Exclude<InboxChannel, 'unknown'>;

export interface ChannelInboundEvent {
  /** Stable external id of the message inside the channel. */
  externalMessageId: string;
  /** Channel-external author identity (e.g. JID-like handle). */
  senderExternalId: string;
  /** Verbatim message text (channel bodies may contain newlines). */
  body: string;
  /** Original send moment (ISO) — preserves ordering of late/retried events. */
  occurredAt?: string;
}

export interface ChannelInboundReceipt {
  tenantId: string;
  conversationId: string;
  messageId: string;
  /** True when the same external id was already ingested (idempotent replay). */
  duplicate: boolean;
  /**
   * Inbound messages are persisted as `dispatched`: the channel already
   * brought the message to the tenant database, so no outbound delivery is
   * pending for them.
   */
  deliveryStatus: 'dispatched';
}

export interface ChannelOutboundRequest {
  messageId: string;
  recipientExternalId: string;
  body: string;
}

export type ChannelFailureKind = 'timeout' | 'provider_error';

export type ChannelDispatchOutcome =
  | { deliveryStatus: 'dispatched'; externalId: string }
  | { deliveryStatus: 'failed'; failureReason: ChannelFailureKind };

/**
 * Provider-side outbound port. It carries no tenant, database or Inbox
 * identifiers other than the persisted message id used for a deterministic
 * response.
 */
export interface ChannelPort {
  readonly adapterId: string;
  readonly productionProvider: boolean;
  dispatchOutbound(
    request: ChannelOutboundRequest,
  ): Promise<ChannelDispatchOutcome>;
}

export const CHANNEL_EXTERNAL_ID_MAX_LENGTH = 200;
export const CHANNEL_BODY_MAX_LENGTH = 10000;

function hasStrictControlCharacters(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f) return true;
  }
  return false;
}

/**
 * Identifier-like channel field (external ids): bounded, single-line, no
 * control characters. Values are trimmed — they are machine identity, never
 * message content.
 */
export function parseChannelExternalRef(
  value: unknown,
  field: string,
  { required = true }: { required?: boolean } = {},
): string | undefined {
  if (value === undefined) {
    if (required) throw validationProblem([{ field, rule: 'required' }]);
    return undefined;
  }
  if (typeof value !== 'string' || hasStrictControlCharacters(value)) {
    throw validationProblem([{ field, rule: 'invalid_value' }]);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > CHANNEL_EXTERNAL_ID_MAX_LENGTH) {
    throw validationProblem([{ field, rule: 'invalid_value' }]);
  }
  return trimmed;
}

/**
 * Channel body text is stored verbatim like every Inbox message body
 * (subject only to the tenant database's own body check), but channel
 * messages legitimately carry line breaks, so only `\n`/`\t` are accepted
 * among control characters.
 */
export function parseChannelBody(value: unknown, field: string): string {
  const rejectWith = () =>
    validationProblem([{ field, rule: 'invalid_value' }]);
  if (typeof value !== 'string') throw rejectWith();
  for (const char of value) {
    const charCode = char.charCodeAt(0);
    if (charCode <= 0x1f || charCode === 0x7f) {
      if (charCode !== 0x0a && charCode !== 0x09) throw rejectWith();
    }
  }
  if (value.length === 0 || value.length > CHANNEL_BODY_MAX_LENGTH) {
    throw rejectWith();
  }
  return value;
}

/** ISO timestamp of the original channel send; resolved to a real Date. */
export function parseChannelOccurredAt(
  value: unknown,
  field: string,
  { required = true }: { required?: boolean } = {},
): Date | undefined {
  if (value === undefined) {
    if (required) throw validationProblem([{ field, rule: 'required' }]);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw validationProblem([{ field, rule: 'invalid_value' }]);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw validationProblem([{ field, rule: 'invalid_format' }]);
  }
  return new Date(parsed);
}

/**
 * Inbound event parsing. Unknown fields are always rejected, which is the
 * runtime copy of the contract rule that provider payloads can never
 * smuggle tenant, database or routing selectors — those come only from the
 * trusted server-side `TenantContext` argument.
 */
export function parseChannelInboundEvent(raw: unknown): ChannelInboundEvent {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw validationProblem([{ field: 'event', rule: 'invalid_value' }]);
  }
  const value = raw as { [key: string]: unknown };
  const allowed = [
    'externalMessageId',
    'senderExternalId',
    'body',
    'occurredAt',
  ];
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw validationProblem(
      unknown.map((field) => ({ field, rule: 'unknown_field' })),
    );
  }
  const externalMessageId = parseChannelExternalRef(
    value.externalMessageId,
    'externalMessageId',
  ) as string;
  const senderExternalId = parseChannelExternalRef(
    value.senderExternalId,
    'senderExternalId',
  ) as string;
  const body = parseChannelBody(value.body, 'body');
  const occurredAt = parseChannelOccurredAt(value.occurredAt, 'occurredAt', {
    required: false,
  });
  return {
    externalMessageId,
    senderExternalId,
    body,
    ...(occurredAt !== undefined
      ? { occurredAt: occurredAt.toISOString() }
      : {}),
  };
}

/**
 * A provider may only bind to a real product channel. `unknown` stays an
 * honest "no provider" state and can never be used to fake a delivery.
 */
export function parseInboxProductChannel(value: unknown): InboxProductChannel {
  if (value !== 'whatsapp' && value !== 'email') {
    throw validationProblem([{ field: 'channel', rule: 'invalid_value' }]);
  }
  return value;
}
