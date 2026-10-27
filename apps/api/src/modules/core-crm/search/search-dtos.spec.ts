import { CrmProblemException } from '../crm-problem-details';
import { parseSearchQueryParams } from './search-dtos';

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

describe('CRM-07 search query validation', () => {
  it('requires a bounded query and supplies default pagination', () => {
    expect(parseSearchQueryParams({ q: '  Acme  ' })).toEqual({
      query: 'Acme',
      page: 1,
      pageSize: 20,
    });
    expect(errorsOf(() => parseSearchQueryParams({ q: 'x' }))).toContainEqual({
      field: 'q',
      rule: 'invalid_value',
    });
  });

  it('rejects unknown fields, control characters, and excessive limits', () => {
    expect(
      errorsOf(() => parseSearchQueryParams({ q: 'valid', tenantId: 'a' })),
    ).toContainEqual({ field: 'tenantId', rule: 'unknown_field' });
    expect(
      errorsOf(() => parseSearchQueryParams({ q: 'ab\ncd' })),
    ).toContainEqual({ field: 'q', rule: 'invalid_value' });
    expect(
      errorsOf(() => parseSearchQueryParams({ q: 'valid', pageSize: '101' })),
    ).toContainEqual({ field: 'pageSize', rule: 'exceeds_limit' });
  });
});
