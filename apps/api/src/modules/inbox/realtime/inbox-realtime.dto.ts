import { validationProblem } from '../../core-crm/crm-problem-details';
import { UUID_PATTERN } from '../../core-crm/crm-dtos';
import { INBOX_REALTIME_MAX_EXPLICIT_SUBSCRIPTIONS } from './inbox-realtime.contracts';

/**
 * INBOX-04 realtime query contract.
 *
 * `conversationId` may be repeated to narrow the stream to specific
 * conversations. Omitting it subscribes to every conversation the session's
 * current `customer_scope` permits. A conversation id is an in-tenant record
 * reference, never a tenant selector: the tenant/database still comes
 * exclusively from the trusted server-side context, and every conversation
 * id is re-authorized at connection and on every event.
 *
 * Unknown fields are rejected so no client value can smuggle routing or
 * protocol options the server does not support.
 */
export interface InboxRealtimeQuery {
  conversationIds: string[];
}

export function parseInboxRealtimeQuery(
  raw: Record<string, unknown>,
): InboxRealtimeQuery {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw validationProblem([
      { field: 'conversationId', rule: 'invalid_value' },
    ]);
  }
  const unknownField = Object.keys(raw).find((key) => key !== 'conversationId');
  if (unknownField) {
    throw validationProblem([{ field: unknownField, rule: 'unknown_field' }]);
  }
  const value = raw.conversationId;
  const rawIds =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  const conversationIds: string[] = [];
  for (const candidate of rawIds) {
    if (candidate === '') continue;
    if (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate)) {
      throw validationProblem([
        { field: 'conversationId', rule: 'invalid_format' },
      ]);
    }
    const normalized = candidate.toLowerCase();
    if (!conversationIds.includes(normalized)) {
      conversationIds.push(normalized);
    }
  }
  if (conversationIds.length > INBOX_REALTIME_MAX_EXPLICIT_SUBSCRIPTIONS) {
    throw validationProblem([
      { field: 'conversationId', rule: 'exceeds_limit' },
    ]);
  }
  return { conversationIds };
}
