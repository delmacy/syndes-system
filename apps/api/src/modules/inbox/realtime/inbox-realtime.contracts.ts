import { randomUUID } from 'node:crypto';

/**
 * INBOX-04 realtime event contract (WebSocket).
 *
 * Events are small, durable-state pointers: after reconnecting, the client
 * MUST rebuild the conversation through the REST API (queue/list, detail,
 * message history, attachment list). Nothing here is a replay buffer, and no
 * resume cursor is used to replay data — the API is the source of truth. `id`
 * exists only so a client can discard a duplicate delivery it already
 * rendered.
 *
 * Payloads are deliberately minimal: ids and state only. Bodies, private note
 * text, filenames, object keys, tenant ids and database names are never sent
 * over the realtime channel; the authorized REST call made after the pointer
 * is the only way to read content. The stream is already scoped by the
 * server-resolved session, and the hub re-authorizes every event.
 */
export type InboxRealtimeEventType =
  | 'inbox.message.created'
  | 'inbox.note.created'
  | 'inbox.conversation.assigned'
  | 'inbox.conversation.status.changed'
  | 'inbox.attachment.created';

export type InboxConversationStatus = 'open' | 'pending' | 'resolved';

/** One pointer shape per event type; no body/content fields are allowed. */
export interface InboxRealtimePayloads {
  'inbox.message.created': { messageId: string };
  'inbox.note.created': { noteId: string };
  'inbox.conversation.assigned': { assigneeActorId: string | null };
  'inbox.conversation.status.changed': {
    status: InboxConversationStatus;
  };
  'inbox.attachment.created': { attachmentId: string };
}

/** Transport-level heartbeat; carries no tenant or conversation data. */
export const INBOX_REALTIME_HEARTBEAT = 'inbox.realtime.heartbeat';
export const INBOX_REALTIME_REVOKED = 'inbox.realtime.revoked';

/** WebSocket endpoint path; authentication is resolved from the handshake. */
export const INBOX_REALTIME_PATH = '/api/v1/inbox/realtime';

/** Optional explicit subscriptions are bounded; the queue UI subscribes implicitly. */
export const INBOX_REALTIME_MAX_EXPLICIT_SUBSCRIPTIONS = 50;

/**
 * Client frames are not part of the protocol (mutations use REST). The bound
 * still protects the server from a huge or binary frame before it is rejected.
 */
export const INBOX_REALTIME_MAX_FRAME_BYTES = 4096;
/** A slow consumer is disconnected instead of growing server memory. */
export const INBOX_REALTIME_MAX_BUFFERED_BYTES = 1024 * 1024;

export interface InboxRealtimeEvent<
  T extends InboxRealtimeEventType = InboxRealtimeEventType,
> {
  id: string;
  type: T;
  conversationId: string;
  occurredAt: string;
  payload: InboxRealtimePayloads[T];
}

export function createInboxRealtimeEvent<T extends InboxRealtimeEventType>(
  type: T,
  conversationId: string,
  payload: InboxRealtimePayloads[T],
  occurredAt: Date = new Date(),
): InboxRealtimeEvent<T> {
  return {
    id: randomUUID(),
    type,
    conversationId,
    occurredAt: occurredAt.toISOString(),
    payload,
  };
}
