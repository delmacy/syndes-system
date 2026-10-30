/**
 * INBOX-03 internal channel contract (PRD-002 Inbox <-> channel boundary).
 *
 * This is the single port between the Inbox domain and channel providers:
 * channel adapters (PRD-003 WhatsApp, e-mail, and the deterministic demo
 * fake) implement `ChannelAdapter` for outbound dispatch or submit
 * `ChannelInboundEvent`s to the ingress service. Nothing in this contract
 * knows a provider SDK, a transport or a network address, and the inbound
 * event contract has NO tenant/database field — tenant and tenant database
 * are always resolved server-side by the channel registry from the trusted
 * binding token, never from provider payload data.
 */

import { validationProblem } from '../../core-crm/crm-problem-details';

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
  /** Server-resolved account key; never accepted from a browser payload. */
  accountId: string;
  /** Server-resolved routing value, consumed only inside the trusted adapter. */
  accountDatabaseName: string;
  conversationId: string;
  messageId: string;
  recipientExternalId: string;
  body: string;
}

export type ChannelDispatchOutcome =
  | { deliveryStatus: 'dispatched'; externalId: string }
  | { deliveryStatus: 'failed'; failureReason: ChannelFailureKind };

export type ChannelFailureKind = 'timeout' | 'provider_error';

/**
 * Provider-side outbound port. A production adapter (whatsmeow, SMTP/Graph,
 * …) joins only through `ChannelAdapterRegistry.registerProductionAdapter`
 * and must declare `productionProvider = true`; the deterministic demo fake
 * declares `productionProvider = false` and can never take a production slot.
 */
export interface ChannelAdapter {
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
 * Identifier-like channel field (external ids, binding tokens): bounded,
 * single-line, no control characters. Values are trimmed — they are
 * machine identity, never message content.
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
  if (typeof value !== 'string')
    throw validationProblem([{ field, rule: 'invalid_value' }]);
  for (const char of value) {
    const charCode = char.charCodeAt(0);
    if (charCode <= 0x1f || charCode === 0x7f) {
      if (charCode !== 0x0a && charCode !== 0x09)
        throw validationProblem([{ field, rule: 'invalid_value' }]);
    }
  }
  if (value.length === 0 || value.length > CHANNEL_BODY_MAX_LENGTH) {
    throw validationProblem([{ field, rule: 'invalid_value' }]);
  }
  return value;
}

/**
 * ISO timestamp of the original channel send; resolved to a real Date.
 */
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
 * trusted registry binding passed separately.
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
    throw validationProblem([{ field: 'event', rule: 'unknown_field' }]);
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

/** Guard for the allowed product channels of inbox conversations. */
export function isPersistedInboxChannel(
  value: unknown,
): value is 'whatsapp' | 'email' | 'unknown' {
  return value === 'whatsapp' || value === 'email' || value === 'unknown';
}
