import { UUID_PATTERN } from '../crm-dtos';
import {
  validationProblem,
  type CrmProblemFieldError,
} from '../crm-problem-details';

/**
 * CRM-06 Note input contracts, validated server-side. A note attaches to
 * exactly one approved CRM target (Person or Organization), passed as
 * UUIDs; unknown and duplicate targets are rejected and no client field
 * ever names a tenant or database target.
 */

export interface NoteInput {
  personId?: string;
  organizationId?: string;
  body: string;
}

export type NoteTargetRef = { personId: string } | { organizationId: string };

export interface NoteResource extends NoteInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const NOTE_BODY_MAX_LENGTH = 10000;

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
    const code = char.charCodeAt(0);
    if (
      (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      code === 0x7f
    )
      return true;
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
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  return trimmed;
}

function uuidField(
  raw: RawValue,
  field: string,
  errors: FieldErrors,
): string | undefined {
  if (raw[field] === undefined) return undefined;
  const value = raw[field];
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    errors.push({ field, rule: 'invalid_format' });
    return undefined;
  }
  return value.toLowerCase();
}

export function parseCreateNoteDto(raw: unknown): NoteInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, [
    'personId',
    'organizationId',
    'body',
  ]);
  const personId = uuidField(value, 'personId', errors);
  const organizationId = uuidField(value, 'organizationId', errors);
  const body = stringField(value, 'body', NOTE_BODY_MAX_LENGTH, errors, {
    required: true,
  });
  if (personId && organizationId) {
    errors.push({ field: 'personId', rule: 'single_target' });
    errors.push({ field: 'organizationId', rule: 'single_target' });
  }
  if (
    typeof personId === 'undefined' &&
    typeof organizationId === 'undefined' &&
    !errors.some((e) => e.field === 'personId' || e.field === 'organizationId')
  ) {
    errors.push({ field: 'target', rule: 'required' });
  }
  if (errors.length) reject(errors);
  return {
    body: body as string,
    ...(personId !== undefined ? { personId } : {}),
    ...(organizationId !== undefined ? { organizationId } : {}),
  };
}

/** Exactly one target query parameter may be present for note lists. */
export function parseNoteTargetQuery(raw: RawValue): {
  personId?: string;
  organizationId?: string;
} {
  const errors = unknownFieldErrors(raw, ['personId', 'organizationId']);
  const personId = raw.personId;
  const organizationId = raw.organizationId;
  if (
    personId !== undefined &&
    (typeof personId !== 'string' || !UUID_PATTERN.test(personId))
  ) {
    errors.push({ field: 'personId', rule: 'invalid_format' });
  }
  if (
    organizationId !== undefined &&
    (typeof organizationId !== 'string' || !UUID_PATTERN.test(organizationId))
  ) {
    errors.push({ field: 'organizationId', rule: 'invalid_format' });
  }
  if (personId && organizationId) {
    errors.push({ field: 'personId', rule: 'single_target' });
  }
  if (!personId && !organizationId && !errors.length) {
    errors.push({ field: 'target', rule: 'required' });
  }
  if (errors.length) reject(errors);
  return {
    ...(typeof personId === 'string'
      ? { personId: personId.toLowerCase() }
      : {}),
    ...(typeof organizationId === 'string'
      ? { organizationId: organizationId.toLowerCase() }
      : {}),
  };
}
