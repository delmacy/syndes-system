import {
  validationProblem,
  type CrmProblemFieldError,
} from '../core-crm/crm-problem-details';
import { UUID_PATTERN } from '../core-crm/crm-dtos';

/**
 * INBOX-02 HTTP contracts, validated server-side. Unknown fields are always
 * rejected and no client field ever names a tenant, database or route
 * target that is not already server-resolved; record identity is always
 * route-scoped (PRD-002 spec).
 */

export type InboxConversationStatus = 'open' | 'pending' | 'resolved';
export type InboxChannel = 'whatsapp' | 'email' | 'unknown';

export interface InboxListQuery {
  status?: InboxConversationStatus;
  assignee?: string;
  channel?: InboxChannel;
  page: number;
  pageSize: number;
}

export interface InboxMessageListQuery {
  after?: string;
  limit: number;
}

export interface InboxMessageCreateInput {
  body: string;
}

export interface InboxNoteCreateInput {
  body: string;
}

export interface InboxAssignmentUpdateInput {
  assigneeActorId: string | null;
}

export interface InboxStatusUpdateInput {
  status: InboxConversationStatus;
}

export const INBOX_BODY_MAX_LENGTH = 10000;
export const INBOX_DEFAULT_MESSAGE_LIMIT = 50;
export const INBOX_MAX_MESSAGE_LIMIT = 200;

const ID_LENGTH_MAX = 200;

type RawValue = { [key: string]: unknown };
type FieldErrors = CrmProblemFieldError[];

function reject(errors: FieldErrors): never {
  throw validationProblem(errors);
}

function asPlainObject(value: unknown): RawValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    reject([{ field: 'body', rule: 'invalid_value' }]);
  }
  return value as RawValue;
}

function unknownFieldErrors(
  raw: RawValue,
  allowed: readonly string[],
): FieldErrors {
  return Object.keys(raw)
    .filter((key) => !allowed.includes(key))
    .map((field) => ({ field, rule: 'unknown_field' }));
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f) return true;
  }
  return false;
}

/**
 * Message/note bodies are stored verbatim and real channel messages are
 * multi-line, so tab/LF/CR are allowed. Every other control character
 * (NUL, BEL, ESC, ...) is rejected before the body ever reaches storage.
 */
function hasForbiddenBodyCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function stringField(
  raw: RawValue,
  field: string,
  maxLength: number,
  errors: FieldErrors,
  options: { required?: boolean } = {},
): string | undefined {
  const value = raw[field];
  if (value === undefined) {
    if (options.required) errors.push({ field, rule: 'required' });
    return undefined;
  }
  if (typeof value !== 'string' || hasControlCharacters(value)) {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  if (value.trim().length === 0 || value.trim().length > maxLength) {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  return value.trim();
}

/** Inbox body text is stored verbatim (only trimmed, no markdown claims). */
function bodyField(raw: RawValue, field: string, errors: FieldErrors): string {
  const value = raw[field];
  if (typeof value !== 'string' || hasForbiddenBodyCharacters(value)) {
    errors.push({ field, rule: 'invalid_value' });
    return '';
  }
  if (value.length === 0 || value.length > INBOX_BODY_MAX_LENGTH) {
    errors.push({ field, rule: 'invalid_value' });
    return '';
  }
  return value;
}

function uuidField(raw: RawValue, field: string, errors: FieldErrors): string {
  const value = raw[field];
  if (typeof value !== 'string') {
    errors.push({ field, rule: 'invalid_value' });
    return '';
  }
  if (!UUID_PATTERN.test(value)) {
    errors.push({ field, rule: 'invalid_format' });
    return '';
  }
  return value.toLowerCase();
}

function positiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0)
    return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (parsed > 0) return parsed;
  }
  return null;
}

/** Empty-string query values mean "filter absent" for every optional query field. */
function dropEmptyFilterValues(value: RawValue): void {
  for (const key of Object.keys(value)) {
    if (value[key] === '') delete value[key];
  }
}

/** Conversation queue filters + pagination (PRD-002 frozen contract).
 * Empty-string query values mean "filter absent". */
export function parseInboxListQuery(
  raw: Record<string, unknown>,
): InboxListQuery {
  const value = asPlainObject(raw);
  dropEmptyFilterValues(value);
  const errors = unknownFieldErrors(value, [
    'status',
    'assignee',
    'channel',
    'page',
    'pageSize',
  ]);
  const status = stringField(value, 'status', 20, errors);
  if (
    status !== undefined &&
    status !== 'open' &&
    status !== 'pending' &&
    status !== 'resolved'
  ) {
    errors.push({ field: 'status', rule: 'invalid_value' });
  }
  const channel = stringField(value, 'channel', 20, errors);
  if (
    channel !== undefined &&
    channel !== 'whatsapp' &&
    channel !== 'email' &&
    channel !== 'unknown'
  ) {
    errors.push({ field: 'channel', rule: 'invalid_value' });
  }
  const assigneeRaw = value['assignee'];
  let assignee: string | undefined;
  if (typeof assigneeRaw === 'string' && UUID_PATTERN.test(assigneeRaw)) {
    assignee = assigneeRaw.toLowerCase();
  } else if (typeof assigneeRaw === 'string' && assigneeRaw !== '') {
    errors.push({ field: 'assignee', rule: 'invalid_format' });
  }
  const page =
    value.page === undefined || value.page === ''
      ? null
      : positiveInt(value.page);
  const pageSize =
    value.pageSize === undefined || value.pageSize === ''
      ? null
      : positiveInt(value.pageSize);
  if (page === null && value.page !== undefined && value.page !== '')
    errors.push({ field: 'page', rule: 'invalid_value' });
  if (
    pageSize === null &&
    value.pageSize !== undefined &&
    value.pageSize !== ''
  ) {
    errors.push({ field: 'pageSize', rule: 'invalid_value' });
  } else if (typeof pageSize === 'number' && pageSize > 100) {
    errors.push({ field: 'pageSize', rule: 'exceeds_limit' });
  }
  if (errors.length) reject(errors);
  return {
    ...(status !== undefined
      ? { status: status as InboxConversationStatus }
      : {}),
    ...(channel !== undefined ? { channel: channel as InboxChannel } : {}),
    ...(assignee !== undefined ? { assignee } : {}),
    page: page ?? 1,
    pageSize: pageSize ?? 20,
  };
}

/** Message history cursor query: `after` = prior message id, `limit` bounded. */
export function parseInboxMessageListQuery(
  raw: Record<string, unknown>,
): InboxMessageListQuery {
  const value = asPlainObject(raw);
  dropEmptyFilterValues(value);
  const errors = unknownFieldErrors(value, ['after', 'limit']);
  const afterRaw = value['after'];
  let after: string | undefined;
  if (afterRaw !== undefined) {
    if (typeof afterRaw === 'string' && UUID_PATTERN.test(afterRaw)) {
      after = afterRaw.toLowerCase();
    } else if (afterRaw !== '') {
      errors.push({ field: 'after', rule: 'invalid_format' });
    }
  }
  const limit =
    value.limit === undefined || value.limit === ''
      ? null
      : positiveInt(value.limit);
  if (limit === null && value.limit !== undefined) {
    errors.push({ field: 'limit', rule: 'invalid_value' });
  } else if (typeof limit === 'number' && limit > INBOX_MAX_MESSAGE_LIMIT) {
    errors.push({ field: 'limit', rule: 'exceeds_limit' });
  }
  if (errors.length) reject(errors);
  return {
    ...(after !== undefined ? { after } : {}),
    limit: limit ?? INBOX_DEFAULT_MESSAGE_LIMIT,
  };
}

export function parseCreateInboxMessageDto(
  raw: unknown,
): InboxMessageCreateInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['body']);
  const body = bodyField(value, 'body', errors);
  if (errors.length) reject(errors);
  return { body };
}

export function parseCreateInboxNoteDto(raw: unknown): InboxNoteCreateInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['body']);
  const body = bodyField(value, 'body', errors);
  if (errors.length) reject(errors);
  return { body };
}

/** `assigneeActorId: null` releases; an actor id must be a UUID. */
export function parseInboxAssignmentUpdateDto(
  raw: unknown,
): InboxAssignmentUpdateInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['assigneeActorId']);
  let assigneeActorId: string | null | undefined;
  const rawValue = value['assigneeActorId'];
  if (rawValue === undefined) {
    errors.push({ field: 'assigneeActorId', rule: 'required' });
  } else if (rawValue === null) {
    assigneeActorId = null;
  } else if (typeof rawValue === 'string') {
    assigneeActorId = uuidField(value, 'assigneeActorId', errors);
  } else {
    errors.push({ field: 'assigneeActorId', rule: 'invalid_value' });
  }
  if (errors.length) reject(errors);
  return { assigneeActorId: assigneeActorId as string | null };
}

export function parseInboxStatusUpdateDto(
  raw: unknown,
): InboxStatusUpdateInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['status']);
  const status = stringField(value, 'status', 20, errors, { required: true });
  if (
    status !== undefined &&
    status !== 'open' &&
    status !== 'pending' &&
    status !== 'resolved'
  ) {
    errors.push({ field: 'status', rule: 'invalid_value' });
  }
  if (errors.length) reject(errors);
  return { status: status as InboxConversationStatus };
}

/**
 * PRD-002 frozen contract: every public reply carries an Idempotency-Key;
 * retries reuse the same key and must never duplicate an outbound message.
 */
export function parseIdempotencyKeyHeader(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    reject([{ field: 'Idempotency-Key', rule: 'required' }]);
  }
  const key = typeof raw === 'string' ? raw.trim() : '';
  if (key.length > ID_LENGTH_MAX) {
    reject([{ field: 'Idempotency-Key', rule: 'exceeds_limit' }]);
  }
  return key;
}
