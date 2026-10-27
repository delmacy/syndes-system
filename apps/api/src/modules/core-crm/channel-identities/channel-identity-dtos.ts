import {
  validationProblem,
  type CrmProblemFieldError,
} from '../crm-problem-details';

/**
 * CRM-06 ChannelIdentity upsert input contracts. The MVP has no real
 * channel integration; rows are seeded through this authorized upsert.
 * Push/business names are external metadata only — they never carry the
 * confirming CRM name, and no client field may target a tenant or
 * database.
 */

export interface ChannelIdentityInput {
  channel: 'whatsapp';
  externalId: string;
  externalUsername?: string;
  pushName?: string;
  businessName?: string;
}

export interface ChannelIdentityResource extends ChannelIdentityInput {
  id: string;
  personId: string;
  createdAt: string;
  updatedAt: string;
}

const EXTERNAL_ID_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 200;
const CHANNELS = ['whatsapp'] as const;

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

/** Trims a bounded display-name field; pushes stable errors when invalid. */
function nameField(
  raw: RawValue,
  field: string,
  errors: FieldErrors,
): string | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || hasControlCharacters(value)) {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > NAME_MAX_LENGTH) {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  return trimmed;
}

export function parseUpsertChannelIdentityDto(
  raw: unknown,
): ChannelIdentityInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, [
    'channel',
    'externalId',
    'externalUsername',
    'pushName',
    'businessName',
  ]);
  const channel = value.channel;
  if (
    typeof channel !== 'string' ||
    !(CHANNELS as readonly string[]).includes(channel)
  ) {
    errors.push({ field: 'channel', rule: 'invalid_value' });
  }
  const externalId = value.externalId;
  let externalIdValue: string | undefined;
  if (
    typeof externalId !== 'string' ||
    hasControlCharacters(externalId) ||
    !externalId.trim() ||
    externalId.trim().length > EXTERNAL_ID_MAX_LENGTH
  ) {
    errors.push({ field: 'externalId', rule: 'invalid_value' });
  } else {
    externalIdValue = externalId.trim();
  }
  const externalUsername = nameField(value, 'externalUsername', errors);
  const pushName = nameField(value, 'pushName', errors);
  const businessName = nameField(value, 'businessName', errors);
  if (errors.length) reject(errors);
  return {
    channel: channel as 'whatsapp',
    externalId: externalIdValue as string,
    ...(externalUsername !== undefined ? { externalUsername } : {}),
    ...(pushName !== undefined ? { pushName } : {}),
    ...(businessName !== undefined ? { businessName } : {}),
  };
}
