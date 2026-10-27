import {
  validationProblem,
  type CrmProblemFieldError,
} from '../crm-problem-details';

/**
 * CRM-06 Tag input contracts, validated server-side. Unknown fields are
 * always rejected and no client field ever names a tenant or database
 * target.
 */

export interface TagInput {
  name: string;
  color?: string;
}

const TAG_NAME_MAX_LENGTH = 100;
const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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

function stringField(
  raw: RawValue,
  field: string,
  maxLength: number,
  errors: FieldErrors,
  options: { required?: boolean; pattern?: RegExp } = {},
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
  if (options.pattern && !options.pattern.test(trimmed)) {
    errors.push({ field, rule: 'invalid_format' });
    return undefined;
  }
  return trimmed;
}

export function parseCreateTagDto(raw: unknown): TagInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['name', 'color']);
  const name = stringField(value, 'name', TAG_NAME_MAX_LENGTH, errors, {
    required: true,
  });
  const color = stringField(value, 'color', 9, errors, {
    pattern: COLOR_PATTERN,
  });
  if (errors.length) reject(errors);
  return {
    name: name as string,
    ...(color !== undefined ? { color } : {}),
  };
}
