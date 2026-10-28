import type { CustomerScope } from '../../platform-core/identity/identity.contracts';
import {
  isCrmProblem,
  parseCreateOrganizationDto,
  parseCreatePersonDto,
} from '../crm-dtos';

export type CsvEntity = 'person' | 'organization';

export interface CsvRowValidation {
  code?: string;
  values?: Record<string, string>;
}

const PERSON_OPTIONAL_FIELDS = ['cpf', 'email', 'phone', 'organizationId'];
const ORGANIZATION_OPTIONAL_FIELDS = ['cnpj', 'email', 'phone'];

/**
 * CRM-08 row validation. Every CSV row is validated with the canonical Core
 * CRM create validators (the same rules the REST create endpoints apply), so
 * a bulk import can never store a record the CRM API would reject. The
 * returned code is a stable, PII-free row error code.
 */
export function validateCsvRow(
  entity: CsvEntity,
  raw: Record<string, string>,
): CsvRowValidation {
  const row = rowPayload(entity, raw);
  try {
    if (entity === 'person') {
      parseCreatePersonDto({ ...row });
    } else {
      parseCreateOrganizationDto({ ...row });
    }
  } catch (error) {
    if (!isCrmProblem(error)) throw error;
    const payload = error.getResponse() as {
      errors?: { field: string; rule: string }[];
    };
    return { code: codeForField(payload.errors?.[0]?.field) };
  }
  const document = entity === 'person' ? row.cpf : row.cnpj;
  if (document && !/^([\d.\-/ ]+)$/.test(document)) {
    return { code: entity === 'person' ? 'invalid_cpf' : 'invalid_cnpj' };
  }
  return { values: normalizeCsvRow(entity, row) };
}

/**
 * A blank optional cell means "not informed": the canonical CRM validators
 * reject a present-but-empty optional field, so empty cells are dropped before
 * validation. Required names are always validated, so a blank required name
 * stays an `invalid_name` row error.
 */
function rowPayload(
  entity: CsvEntity,
  raw: Record<string, string>,
): Record<string, string> {
  const optional = optionalFields(entity);
  const row: Record<string, string> = {};
  for (const [field, value] of Object.entries(raw)) {
    if (optional.includes(field) && value.trim() === '') continue;
    row[field] = value;
  }
  return row;
}

function optionalFields(entity: CsvEntity): readonly string[] {
  return entity === 'person'
    ? PERSON_OPTIONAL_FIELDS
    : ORGANIZATION_OPTIONAL_FIELDS;
}

/**
 * CSV scope rule applied before row validation: a `pj` attendant may only
 * import linked contact Persons and a `cpf` attendant may never import a PJ
 * link. Authorization decisions are never reported as field validation.
 */
export function csvScopeRowCode(
  entity: CsvEntity,
  scope: CustomerScope,
  raw: Record<string, string>,
): string | undefined {
  if (entity !== 'person') return undefined;
  const organizationId = (raw.organizationId ?? '').trim();
  if (scope === 'pj' && !organizationId) {
    return 'organization_required_for_scope';
  }
  if (scope === 'cpf' && organizationId) {
    return 'organization_outside_scope';
  }
  return undefined;
}

/**
 * Canonical row values: the CRM validators trim the text fields and lower
 * case the UUID link, so the imported record matches the validated record.
 */
function normalizeCsvRow(
  entity: CsvEntity,
  raw: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  if (entity === 'person') {
    if (raw.fullName !== undefined) values.fullName = raw.fullName.trim();
    if (raw.cpf) values.cpf = raw.cpf.trim();
    if (raw.email) values.email = raw.email.trim();
    if (raw.phone) values.phone = raw.phone.trim();
    if (raw.organizationId) {
      values.organizationId = raw.organizationId.trim().toLowerCase();
    }
    return values;
  }
  if (raw.name !== undefined) values.name = raw.name.trim();
  if (raw.cnpj) values.cnpj = raw.cnpj.trim();
  if (raw.email) values.email = raw.email.trim();
  if (raw.phone) values.phone = raw.phone.trim();
  return values;
}

function codeForField(field: string | undefined): string {
  switch (field) {
    case 'fullName':
    case 'name':
      return 'invalid_name';
    case 'email':
      return 'invalid_email';
    case 'phone':
      return 'invalid_phone';
    case 'cpf':
      return 'invalid_cpf';
    case 'cnpj':
      return 'invalid_cnpj';
    case 'organizationId':
      return 'organization_not_found';
    default:
      return 'invalid_row';
  }
}
