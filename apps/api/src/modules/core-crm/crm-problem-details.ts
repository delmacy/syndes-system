import { HttpException, HttpStatus } from '@nestjs/common';

export interface CrmProblemFieldError {
  field: string;
  rule: string;
}

export interface CrmProblemPayload {
  code: string;
  detail?: string;
  statusCode?: HttpStatus;
  errors?: CrmProblemFieldError[];
}

/**
 * CRM-05 problem exception (CRM-00 error contract, RFC 9457 renderer).
 *
 * The API registers the global Problem Details filter exactly once (in the
 * Manager module); it renders every exception whose response payload has the
 * stable `{code, errors?}` shape. This class carries that shape for Core CRM
 * routes without importing manager module internals, so record, authorization
 * and validation errors render as `application/problem+json` with a stable
 * `code` and a fresh `requestId`.
 */
export class CrmProblemException extends HttpException {
  constructor(private readonly payload: CrmProblemPayload) {
    super(payload, payload.statusCode ?? HttpStatus.BAD_REQUEST);
    this.message = payload.detail ?? payload.code;
  }
}

export function validationProblem(
  errors: CrmProblemFieldError[],
): CrmProblemException {
  return new CrmProblemException({
    code: 'validation_failed',
    statusCode: HttpStatus.BAD_REQUEST,
    detail: 'Request input is invalid.',
    errors,
  });
}

export function notFoundProblem(
  code: string,
  detail?: string,
): CrmProblemException {
  return new CrmProblemException({
    code,
    statusCode: HttpStatus.NOT_FOUND,
    detail,
  });
}

export function conflictProblem(
  code: string,
  detail?: string,
): CrmProblemException {
  return new CrmProblemException({
    code,
    statusCode: HttpStatus.CONFLICT,
    detail,
  });
}

export function scopeDeniedProblem(detail: string): CrmProblemException {
  return new CrmProblemException({
    code: 'scope_denied',
    statusCode: HttpStatus.FORBIDDEN,
    detail,
  });
}

export function forbiddenProblem(detail: string): CrmProblemException {
  return new CrmProblemException({
    code: 'forbidden',
    statusCode: HttpStatus.FORBIDDEN,
    detail,
  });
}

const PG_CONFLICT_CODES: Record<string, string> = {
  crm_organizations_cnpj_unique: 'organization_cnpj_conflict',
  crm_people_cpf_unique: 'person_cpf_conflict',
  crm_relationships_person_org_pk: 'relationship_exists_conflict',
  crm_employees_actor_unique: 'employee_actor_conflict',
};

/** Postgres unique violation -> stable conflict problem (values never leak). */
export function conflictProblemFor(
  constraintName: string | undefined,
): CrmProblemException {
  return conflictProblem(
    (constraintName && PG_CONFLICT_CODES[constraintName]) || 'conflict',
  );
}

/**
 * Unwraps drizzle/pg error chains to surface the underlying Postgres error,
 * so drivers that wrap rethrown errors (DrizzleQueryError.cause) still map.
 */
export function pgErrorCause(error: unknown): {
  code?: string;
  constraint?: string;
} {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === 'object' &&
      typeof (current as { code?: unknown }).code === 'string'
    ) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return {};
}
