import {
  CrmProblemException,
  validationProblem,
  type CrmProblemFieldError,
} from './crm-problem-details';

/**
 * CRM-05 Core CRM DTO contracts, validated server-side. Unknown fields are
 * always rejected: `tenant_id`, `database_name` or any tenant/database
 * selector never exists as a client field (CRM-00), and record identity is
 * always route-scoped, never body-supplied.
 */

export interface OrganizationInput {
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
}

export interface PersonInput {
  fullName: string;
  cpf?: string;
  email?: string;
  phone?: string;
}

export interface LinkedPersonInput extends PersonInput {
  /** Optional initialPJ contact link; required for `pj`-scoped members. */
  organizationId?: string;
}

export interface RelationshipInput {
  personId: string;
  organizationId: string;
}

export interface EmployeeInput {
  displayName: string;
  active?: boolean;
  controlPlaneActorId?: string;
}

export interface ListQuery {
  page: number;
  pageSize: number;
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
const NAME_MAX_LENGTH = 200;
const DOCUMENT_MAX_LENGTH = 20;
const EMAIL_MAX_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/;
const PHONE_MAX_LENGTH = 32;

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

/** Trimmed text field; pushes a stable validation error when present-but-invalid. */
function stringField(
  raw: RawValue,
  field: string,
  maxLength: number,
  errors: FieldErrors,
  options: { required?: boolean; pattern?: RegExp; field?: string } = {},
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

function uuidField(raw: RawValue, field: string, errors: FieldErrors): string {
  const value = raw[field];
  if (typeof value !== 'string') {
    errors.push({ field, rule: 'required' });
    return '';
  }
  if (!UUID_PATTERN.test(value)) {
    errors.push({ field, rule: 'invalid_format' });
    return '';
  }
  return value.toLowerCase();
}

function uuidFieldOptional(
  raw: RawValue,
  field: string,
  errors: FieldErrors,
): string | undefined {
  if (raw[field] === undefined) return undefined;
  return uuidField(raw, field, errors) || undefined;
}

function booleanFieldOptional(
  raw: RawValue,
  field: string,
  errors: FieldErrors,
): boolean | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    errors.push({ field, rule: 'invalid_value' });
    return undefined;
  }
  return value;
}

/** PostgreSQL UUID path identifier; rejects arbitrary strings before lookup. */
export function parseUuidParam(value: string, field = 'id'): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    reject([{ field, rule: 'invalid_format' }]);
  }
  return value.toLowerCase();
}

export function parseListQuery(raw: RawValue): ListQuery {
  const errors = unknownFieldErrors(raw, ['page', 'pageSize']);
  const page = positiveInt(raw.page);
  const pageSize = positiveInt(raw.pageSize);
  if (page === null) errors.push({ field: 'page', rule: 'invalid_value' });
  if (pageSize === null)
    errors.push({ field: 'pageSize', rule: 'invalid_value' });
  else if (pageSize > MAX_PAGE_SIZE)
    errors.push({ field: 'pageSize', rule: 'exceeds_limit' });
  if (errors.length) reject(errors);
  return { page: page as number, pageSize: pageSize as number };
}

export function defaultListQuery(): ListQuery {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

/** Coerces raw query params and applies defaults for absent pages. */
export function parseListQueryParams(raw: Record<string, unknown>): ListQuery {
  return Object.keys(raw ?? {}).length
    ? parseListQuery(asPlainObject(raw))
    : defaultListQuery();
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

export function parseCreateOrganizationDto(raw: unknown): OrganizationInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['name', 'cnpj', 'email', 'phone']);
  const name = stringField(value, 'name', NAME_MAX_LENGTH, errors, {
    required: true,
  });
  const cnpj = stringField(value, 'cnpj', DOCUMENT_MAX_LENGTH, errors);
  const email = stringField(value, 'email', EMAIL_MAX_LENGTH, errors, {
    pattern: EMAIL_PATTERN,
  });
  const phone = stringField(value, 'phone', PHONE_MAX_LENGTH, errors);
  if (errors.length) reject(errors);
  return {
    name: name as string,
    ...(cnpj !== undefined ? { cnpj } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
  };
}

export function parseUpdateOrganizationDto(
  raw: unknown,
): Partial<OrganizationInput> {
  return partialRecordDto(
    raw,
    ['name', 'cnpj', 'email', 'phone'],
    (value, errors) => {
      const result: Record<string, string> = {};
      const name = stringField(value, 'name', NAME_MAX_LENGTH, errors);
      if (name !== undefined) result.name = name;
      const cnpj = stringField(value, 'cnpj', DOCUMENT_MAX_LENGTH, errors);
      if (cnpj !== undefined) result.cnpj = cnpj;
      const email = stringField(value, 'email', EMAIL_MAX_LENGTH, errors, {
        pattern: EMAIL_PATTERN,
      });
      if (email !== undefined) result.email = email;
      const phone = stringField(value, 'phone', PHONE_MAX_LENGTH, errors);
      if (phone !== undefined) result.phone = phone;
      return result;
    },
  );
}

export function parseCreatePersonDto(raw: unknown): LinkedPersonInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, [
    'fullName',
    'cpf',
    'email',
    'phone',
    'organizationId',
  ]);
  const fullName = stringField(value, 'fullName', NAME_MAX_LENGTH, errors, {
    required: true,
  });
  const cpf = stringField(value, 'cpf', DOCUMENT_MAX_LENGTH, errors);
  const email = stringField(value, 'email', EMAIL_MAX_LENGTH, errors, {
    pattern: EMAIL_PATTERN,
  });
  const phone = stringField(value, 'phone', PHONE_MAX_LENGTH, errors);
  const organizationId = uuidFieldOptional(value, 'organizationId', errors);
  if (errors.length) reject(errors);
  return {
    fullName: fullName as string,
    ...(cpf !== undefined ? { cpf } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(organizationId !== undefined ? { organizationId } : {}),
  };
}

export function parseUpdatePersonDto(raw: unknown): Partial<PersonInput> {
  return partialRecordDto(
    raw,
    ['fullName', 'cpf', 'email', 'phone'],
    (value, errors) => {
      const result: Record<string, string> = {};
      const fullName = stringField(value, 'fullName', NAME_MAX_LENGTH, errors);
      if (fullName !== undefined) result.fullName = fullName;
      const cpf = stringField(value, 'cpf', DOCUMENT_MAX_LENGTH, errors);
      if (cpf !== undefined) result.cpf = cpf;
      const email = stringField(value, 'email', EMAIL_MAX_LENGTH, errors, {
        pattern: EMAIL_PATTERN,
      });
      if (email !== undefined) result.email = email;
      const phone = stringField(value, 'phone', PHONE_MAX_LENGTH, errors);
      if (phone !== undefined) result.phone = phone;
      return result;
    },
  );
}

export function parseCreateRelationshipDto(raw: unknown): RelationshipInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, [
    'personId',
    'organizationId',
    'role',
  ]);
  const roleValue = stringField(value, 'role', 50, errors);
  if (roleValue !== undefined && roleValue !== 'contact') {
    errors.push({ field: 'role', rule: 'invalid_value' });
  }
  const personId = uuidField(value, 'personId', errors);
  const organizationId = uuidField(value, 'organizationId', errors);
  if (errors.length) reject(errors);
  return { personId, organizationId };
}

export function parseCreateEmployeeDto(raw: unknown): EmployeeInput {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, [
    'displayName',
    'active',
    'controlPlaneActorId',
  ]);
  const displayName = stringField(
    value,
    'displayName',
    NAME_MAX_LENGTH,
    errors,
    {
      required: true,
    },
  );
  const active = booleanFieldOptional(value, 'active', errors);
  const controlPlaneActorId = uuidFieldOptional(
    value,
    'controlPlaneActorId',
    errors,
  );
  if (errors.length) reject(errors);
  return {
    displayName: displayName as string,
    ...(active !== undefined ? { active } : {}),
    ...(controlPlaneActorId !== undefined ? { controlPlaneActorId } : {}),
  };
}

export function parseUpdateEmployeeDto(raw: unknown): Partial<EmployeeInput> {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['displayName', 'active']);
  const displayName = stringField(
    value,
    'displayName',
    NAME_MAX_LENGTH,
    errors,
  );
  const active = booleanFieldOptional(value, 'active', errors);
  if (errors.length) reject(errors);
  if (displayName === undefined && active === undefined) {
    reject([{ field: 'body', rule: 'no_fields' }]);
  }
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    ...(active !== undefined ? { active } : {}),
  };
}

function partialRecordDto(
  raw: unknown,
  allowed: readonly string[],
  fill: (value: RawValue, errors: FieldErrors) => Record<string, unknown>,
): Record<string, unknown> {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, allowed);
  const result = fill(value, errors);
  if (errors.length) reject(errors);
  if (!Object.keys(value).length) {
    reject([{ field: 'body', rule: 'no_fields' }]);
  }
  return result;
}

export function isCrmProblem(error: unknown): error is CrmProblemException {
  return error instanceof CrmProblemException;
}
