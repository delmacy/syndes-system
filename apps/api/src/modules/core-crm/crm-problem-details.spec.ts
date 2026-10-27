import {
  validationProblem,
  notFoundProblem,
  conflictProblem,
  scopeDeniedProblem,
  forbiddenProblem,
  conflictProblemFor,
  pgErrorCause,
  CrmProblemException,
} from './crm-problem-details';
import { managerExceptionPayload } from '../platform-core/manager/manager-problem-details';

describe('CRM problem details (CRM-05)', () => {
  it('renders validation, not-found and conflict problems with stable codes', () => {
    const validation = validationProblem([{ field: 'name', rule: 'required' }]);
    expect(validation.getStatus()).toBe(400);
    expect(validation.getResponse()).toMatchObject({
      code: 'validation_failed',
      statusCode: 400,
      errors: [{ field: 'name', rule: 'required' }],
    });

    const missing = notFoundProblem('organization_not_found');
    expect(missing.getStatus()).toBe(404);
    expect(missing.getResponse()).toMatchObject({
      code: 'organization_not_found',
      statusCode: 404,
    });

    const conflict = conflictProblem('relationship_exists_conflict');
    expect(conflict.getStatus()).toBe(409);
    expect(conflict.getResponse()).toMatchObject({
      code: 'relationship_exists_conflict',
      statusCode: 409,
    });
  });

  it('uses scope_denied for customer scope denials and forbidden for role denials', () => {
    expect(scopeDeniedProblem('detail').getStatus()).toBe(403);
    expect(scopeDeniedProblem('detail').getResponse()).toMatchObject({
      code: 'scope_denied',
      statusCode: 403,
    });
    expect(forbiddenProblem('detail').getResponse()).toMatchObject({
      code: 'forbidden',
      statusCode: 403,
    });
  });

  it('maps tenant constraint violations to stable conflict codes only', () => {
    expect(
      conflictProblemFor('crm_people_cpf_unique').getResponse(),
    ).toMatchObject({ code: 'person_cpf_conflict' });
    expect(
      conflictProblemFor('crm_relationships_person_org_pk').getResponse(),
    ).toMatchObject({ code: 'relationship_exists_conflict' });
    expect(conflictProblemFor(undefined).getResponse()).toMatchObject({
      code: 'conflict',
    });
    expect(
      conflictProblemFor('unrelated_constraint').getResponse(),
    ).toMatchObject({ code: 'conflict' });
  });

  it('unwraps driver-wrapped errors to find the Postgres error', () => {
    const pgError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'crm_organizations_cnpj_unique',
    });
    expect(pgErrorCause(pgError)).toMatchObject({
      code: '23505',
      constraint: 'crm_organizations_cnpj_unique',
    });
    expect(
      pgErrorCause(new Error('wrapped', { cause: pgError })),
    ).toMatchObject({ code: '23505' });
    expect(pgErrorCause(undefined)).toEqual({});
    expect(pgErrorCause('nope')).toEqual({});
  });

  it('keeps the payload shape compatible with the single global Problem Details filter', () => {
    const compatible: CrmProblemException[] = [
      validationProblem([{ field: 'name', rule: 'invalid_value' }]),
      notFoundProblem('person_not_found'),
      conflictProblem('resource_archived'),
      scopeDeniedProblem('scope'),
      forbiddenProblem('role'),
      conflictProblemFor('crm_employees_actor_unique'),
    ];
    for (const exception of compatible) {
      const payload = managerExceptionPayload(exception);
      expect(payload).not.toBeNull();
      expect(payload?.code).toMatch(/^[a-z][a-z0-9_.]{0,99}$/);
      for (const error of payload?.errors ?? []) {
        expect(typeof error.field).toBe('string');
        expect(typeof error.rule).toBe('string');
      }
    }
  });
});
