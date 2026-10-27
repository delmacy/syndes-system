import { HttpStatus } from '@nestjs/common';
import {
  ManagerProblemException,
  type ProblemDetailsFieldError,
} from './manager-problem-details';

/**
 * CRM-04 manager DTO contracts. Inputs are plain objects validated here
 * server-side; the manager accepts no tenant/database selectors, no
 * identifiers that resolve tenants by name, and no unknown fields.
 */

export interface CreateTenantDto {
  displayName: string;
}

export interface UpdateTenantDto {
  displayName: string;
}

export interface AssignInitialAdminDto {
  issuer: string;
  subject: string;
}

export interface ListTenantsQuery {
  page: number;
  pageSize: number;
}

export const TENANT_DISPLAY_NAME_MAX_LENGTH = 200;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
const KEYCLOAK_SUBJECT_PATTERN = /^[A-Za-z0-9_.~-]{1,255}$/;

type RawValue = { [key: string]: unknown };

function reject(
  code: string,
  status: HttpStatus,
  detail: string,
  errors?: ProblemDetailsFieldError[],
): never {
  throw new ManagerProblemException({
    code,
    statusCode: status,
    detail,
    errors,
  });
}

function asPlainObject(value: unknown): RawValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    reject(
      'invalid_body',
      HttpStatus.BAD_REQUEST,
      'Request body must be a JSON object.',
    );
  }
  return value as RawValue;
}

function unknownFieldErrors(
  raw: RawValue,
  allowedKeys: readonly string[],
): ProblemDetailsFieldError[] {
  return Object.keys(raw)
    .filter((key) => !allowedKeys.includes(key))
    .map((field) => ({ field, rule: 'unknown_field' }));
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function displayNameErrors(raw: RawValue): ProblemDetailsFieldError[] {
  const value = raw.displayName;
  if (typeof value !== 'string') {
    return [{ field: 'displayName', rule: 'required' }];
  }
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > TENANT_DISPLAY_NAME_MAX_LENGTH ||
    hasControlCharacters(trimmed)
  ) {
    return [{ field: 'displayName', rule: 'invalid_value' }];
  }
  return [];
}

function displayNameOf(raw: RawValue, allowedKeys: readonly string[]): string {
  const errors = [
    ...unknownFieldErrors(raw, allowedKeys),
    ...displayNameErrors(raw),
  ];
  if (errors.length) {
    reject(
      'validation_failed',
      HttpStatus.BAD_REQUEST,
      'Request body contains invalid fields.',
      errors,
    );
  }
  return (raw.displayName as string).trim();
}

export function parseCreateTenantDto(raw: unknown): CreateTenantDto {
  return { displayName: displayNameOf(asPlainObject(raw), ['displayName']) };
}

export function parseUpdateTenantDto(raw: unknown): UpdateTenantDto {
  return { displayName: displayNameOf(asPlainObject(raw), ['displayName']) };
}

export function parseAssignInitialAdminDto(
  raw: unknown,
): AssignInitialAdminDto {
  const value = asPlainObject(raw);
  const errors = unknownFieldErrors(value, ['issuer', 'subject']);

  const issuerRaw = value.issuer;
  if (typeof issuerRaw !== 'string' || !issuerRaw.trim()) {
    errors.push({ field: 'issuer', rule: 'required' });
  }
  if (
    typeof value.subject !== 'string' ||
    !KEYCLOAK_SUBJECT_PATTERN.test(value.subject)
  ) {
    errors.push({
      field: 'subject',
      rule: typeof value.subject === 'string' ? 'invalid_format' : 'required',
    });
  }
  if (errors.length) {
    reject(
      'validation_failed',
      HttpStatus.BAD_REQUEST,
      'issuer and subject are required.',
      errors,
    );
  }
  return {
    issuer: (issuerRaw as string).trim(),
    subject: value.subject as string,
  };
}

export function parseListTenantsQuery(raw: RawValue): ListTenantsQuery {
  const page = parsePositiveInt(raw.page);
  const pageSize = parsePositiveInt(raw.pageSize);
  const errors: ProblemDetailsFieldError[] = [];
  if (page === null) errors.push({ field: 'page', rule: 'invalid_value' });
  if (pageSize === null)
    errors.push({ field: 'pageSize', rule: 'invalid_value' });
  else if (pageSize > MAX_PAGE_SIZE)
    errors.push({ field: 'pageSize', rule: 'exceeds_limit' });
  if (errors.length) {
    reject(
      'validation_failed',
      HttpStatus.BAD_REQUEST,
      `page and pageSize must be positive integers (pageSize <= ${MAX_PAGE_SIZE}).`,
      errors,
    );
  }
  return { page: page as number, pageSize: pageSize as number };
}

export function defaultListTenantsQuery(): ListTenantsQuery {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0)
    return value;
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    if (parsed > 0) return parsed;
  }
  return null;
}

const TENANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant identifiers are permanent PostgreSQL UUIDs. Anything else is
 * rejected before a lookup so the API never confirms or denies arbitrary
 * resource existence.
 */
export function parseTenantIdParam(raw: string): string {
  if (!TENANT_ID_PATTERN.test(raw)) {
    reject(
      'validation_failed',
      HttpStatus.BAD_REQUEST,
      'tenantId must be a UUID.',
      [{ field: 'tenantId', rule: 'invalid_format' }],
    );
  }
  return raw.toLowerCase();
}
