import { CrmProblemException } from '../crm-problem-details';
import { parseDuplicateCheckQuery } from './duplicate-dtos';

function errorsOf(run: () => unknown): { field: string; rule: string }[] {
  try {
    run();
  } catch (error) {
    if (error instanceof CrmProblemException) {
      return (
        error.getResponse() as { errors: { field: string; rule: string }[] }
      ).errors;
    }
    throw error;
  }
  throw new Error('expected validation failure');
}

describe('CRM-07 duplicate input validation', () => {
  it('accepts a Person with formatted identifier while preserving presentation', () => {
    expect(
      parseDuplicateCheckQuery({ entityType: 'person', cpf: '123.456.789-01' }),
    ).toEqual({ entityType: 'person', cpf: '123.456.789-01' });
  });

  it('accepts Organization identifiers and rejects empty or invalid input', () => {
    expect(
      parseDuplicateCheckQuery({
        entityType: 'organization',
        cnpj: '12.345.678/0001-90',
      }),
    ).toEqual({ entityType: 'organization', cnpj: '12.345.678/0001-90' });
    expect(
      errorsOf(() => parseDuplicateCheckQuery({ entityType: 'person' })),
    ).toContainEqual({ field: 'criteria', rule: 'required' });
    expect(
      errorsOf(() =>
        parseDuplicateCheckQuery({ entityType: 'person', cpf: '123' }),
      ),
    ).toContainEqual({ field: 'cpf', rule: 'invalid_format' });
  });

  it('rejects client-controlled fields', () => {
    expect(
      errorsOf(() =>
        parseDuplicateCheckQuery({
          entityType: 'person',
          email: 'a@b.com',
          tenantId: 'other-tenant',
        }),
      ),
    ).toContainEqual({ field: 'tenantId', rule: 'unknown_field' });
  });
});
