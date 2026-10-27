import { normalizeDigits } from '../normalization/normalize';
import {
  validationProblem,
  type CrmProblemFieldError,
} from '../crm-problem-details';

export type DuplicateCheckInput =
  | {
      entityType: 'person';
      fullName?: string;
      cpf?: string;
      email?: string;
      phone?: string;
    }
  | {
      entityType: 'organization';
      name?: string;
      cnpj?: string;
      email?: string;
      phone?: string;
    };

type RawValue = Record<string, unknown>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+(?:\.[^\s@]+)+$/;

function fail(errors: CrmProblemFieldError[]): never {
  throw validationProblem(errors);
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 0x1f || char.charCodeAt(0) === 0x7f) return true;
  }
  return false;
}

function readText(
  raw: RawValue,
  field: string,
  errors: CrmProblemFieldError[],
  maxLength: number,
): string | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.trim().length > maxLength ||
    hasControlCharacters(value)
  ) {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  return value.trim();
}

function rejectUnknown(
  raw: RawValue,
  allowed: readonly string[],
  errors: CrmProblemFieldError[],
): void {
  for (const field of Object.keys(raw)) {
    if (!allowed.includes(field)) errors.push({ field, rule: 'unknown_field' });
  }
}

export function parseDuplicateCheckQuery(raw: RawValue): DuplicateCheckInput {
  const errors: CrmProblemFieldError[] = [];
  const entityType = raw.entityType;
  if (entityType !== 'person' && entityType !== 'organization') {
    errors.push({ field: 'entityType', rule: 'invalid_value' });
    fail(errors);
  }

  const fields =
    entityType === 'person'
      ? ['entityType', 'fullName', 'cpf', 'email', 'phone']
      : ['entityType', 'name', 'cnpj', 'email', 'phone'];
  rejectUnknown(raw, fields, errors);

  const nameField = entityType === 'person' ? 'fullName' : 'name';
  const name = readText(raw, nameField, errors, 200);
  const email = readText(raw, 'email', errors, 320);
  const phone = readText(raw, 'phone', errors, 32);
  const documentField = entityType === 'person' ? 'cpf' : 'cnpj';
  const document = readText(raw, documentField, errors, 20);

  if (email && !EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', rule: 'invalid_format' });
  }
  if (
    phone &&
    (normalizeDigits(phone).length < 7 || normalizeDigits(phone).length > 15)
  ) {
    errors.push({ field: 'phone', rule: 'invalid_format' });
  }
  if (
    document &&
    normalizeDigits(document).length !== (entityType === 'person' ? 11 : 14)
  ) {
    errors.push({ field: documentField, rule: 'invalid_format' });
  }
  if (!name && !email && !phone && !document) {
    errors.push({ field: 'criteria', rule: 'required' });
  }
  if (errors.length) fail(errors);

  return entityType === 'person'
    ? {
        entityType,
        ...(name !== undefined ? { fullName: name } : {}),
        ...(document !== undefined ? { cpf: document } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      }
    : {
        entityType,
        ...(name !== undefined ? { name } : {}),
        ...(document !== undefined ? { cnpj: document } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      };
}
