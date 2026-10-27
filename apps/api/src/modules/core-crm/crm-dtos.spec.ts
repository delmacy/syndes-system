import {
  defaultListQuery,
  parseCreateEmployeeDto,
  parseCreateOrganizationDto,
  parseCreatePersonDto,
  parseCreateRelationshipDto,
  parseListQuery,
  parseUpdateEmployeeDto,
  parseUpdateOrganizationDto,
  parseUpdatePersonDto,
  parseUuidParam,
} from './crm-dtos';
import { CrmProblemException } from './crm-problem-details';

function expectValidation(run: () => unknown) {
  try {
    run();
    throw new Error('expected validation failure');
  } catch (error) {
    if (error instanceof CrmProblemException) {
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.code).toBe('validation_failed');
      return response.errors as { field: string; rule: string }[];
    }
    expect((error as Error).message).toBe('expected validation failure');
  }
}

describe('Core CRM DTO validation (CRM-05)', () => {
  it('parses unknown id path segments before any lookup', () => {
    expect(parseUuidParam('00000000-0000-4000-8000-000000000001')).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(
      parseUuidParam('0F11BE79-0000-4000-8000-000000000001').startsWith('0f11'),
    ).toBe(true);
    const errors = expectValidation(() => parseUuidParam('not-a-uuid'));
    expect(errors).toEqual([{ field: 'id', rule: 'invalid_format' }]);
  });

  it('defaults and bounds list pagination', () => {
    expect(defaultListQuery()).toEqual({ page: 1, pageSize: 20 });
    expect(parseListQuery({ page: '1', pageSize: '20' })).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(parseListQuery({ page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
    });
    const tooBig = expectValidation(() =>
      parseListQuery({ page: '1', pageSize: '101' }),
    );
    expect(tooBig).toContainEqual({
      field: 'pageSize',
      rule: 'exceeds_limit',
    });
    const nonNumeric = expectValidation(() => parseListQuery({ page: 'x' }));
    expect(nonNumeric).toContainEqual({ field: 'page', rule: 'invalid_value' });
    expect(
      expectValidation(() => parseListQuery({ tenant_id: 'x' })),
    ).toContainEqual({ field: 'tenant_id', rule: 'unknown_field' });
  });

  it('validates organization create/update bodies strictly', () => {
    const created = parseCreateOrganizationDto({
      name: '  Org  ',
      cnpj: '12.345.678/0001-00',
      email: 'a@b.co',
      phone: '555',
    });
    expect(created).toEqual({
      name: 'Org',
      cnpj: '12.345.678/0001-00',
      email: 'a@b.co',
      phone: '555',
    });

    expect(
      expectValidation(() =>
        parseCreateOrganizationDto({ name: 'x', tenant_id: 't' }),
      ),
    ).toEqual([{ field: 'tenant_id', rule: 'unknown_field' }]);

    const emptyName = expectValidation(() =>
      parseCreateOrganizationDto({ name: '   ' }),
    );
    expect(emptyName).toContainEqual({ field: 'name', rule: 'invalid_value' });

    const bigName = expectValidation(() =>
      parseCreateOrganizationDto({ name: 'n'.repeat(201) }),
    );
    expect(bigName).toContainEqual({ field: 'name', rule: 'invalid_value' });

    const badEmail = expectValidation(() =>
      parseCreateOrganizationDto({ name: 'n', email: 'nope' }),
    );
    expect(badEmail).toContainEqual({ field: 'email', rule: 'invalid_format' });

    const bigDocument = expectValidation(() =>
      parseCreateOrganizationDto({ name: 'n', cnpj: 'c'.repeat(21) }),
    );
    expect(bigDocument).toContainEqual({
      field: 'cnpj',
      rule: 'invalid_value',
    });

    expect(
      parseUpdateOrganizationDto({ name: 'Renamed', email: 'x@y.z' }),
    ).toEqual({ name: 'Renamed', email: 'x@y.z' });

    expect(
      expectValidation(() => parseUpdateOrganizationDto({})),
    ).toContainEqual({ field: 'body', rule: 'no_fields' });

    expect(
      expectValidation(() => parseUpdateOrganizationDto({ archivedAt: 'x' })),
    ).toContainEqual({ field: 'archivedAt', rule: 'unknown_field' });

    expect(parseUpdateOrganizationDto({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('validates person create/update bodies and pj link ids', () => {
    const created = parseCreatePersonDto({
      fullName: 'Ana',
      cpf: '111.222.333-44',
      organizationId: '00000000-0000-4000-8000-000000000001',
    });
    expect(created).toEqual({
      fullName: 'Ana',
      cpf: '111.222.333-44',
      organizationId: '00000000-0000-4000-8000-000000000001',
    });

    expect(
      expectValidation(() =>
        parseCreatePersonDto({ fullName: 'Ana', organizationId: 'nope' }),
      ),
    ).toContainEqual({
      field: 'organizationId',
      rule: 'invalid_format',
    });

    expect(parseUpdatePersonDto({ fullName: 'Novo nome' })).toEqual({
      fullName: 'Novo nome',
    });

    expect(
      expectValidation(() => parseUpdatePersonDto({ organizationId: 'x' })),
    ).toContainEqual({ field: 'organizationId', rule: 'unknown_field' });
  });

  it('validates relationship links with both UUID sides', () => {
    const created = parseCreateRelationshipDto({
      personId: '00000000-0000-4000-8000-000000000002',
      organizationId: '00000000-0000-4000-8000-000000000003',
      role: 'contact',
    });
    expect(created).toEqual({
      personId: '00000000-0000-4000-8000-000000000002',
      organizationId: '00000000-0000-4000-8000-000000000003',
    });

    const missing = expectValidation(() =>
      parseCreateRelationshipDto({ personId: 'x', organizationId: 'x' }),
    );
    expect(missing).toEqual([
      { field: 'personId', rule: 'invalid_format' },
      { field: 'organizationId', rule: 'invalid_format' },
    ]);

    expect(
      expectValidation(() =>
        parseCreateRelationshipDto({
          personId: '00000000-0000-4000-8000-000000000002',
          organizationId: '00000000-0000-4000-8000-000000000003',
          role: 'owner',
        }),
      ),
    ).toContainEqual({ field: 'role', rule: 'invalid_value' });
  });

  it('validates employee bodies without any credential field', () => {
    const created = parseCreateEmployeeDto({
      displayName: 'Atendente Um',
      controlPlaneActorId: '00000000-0000-4000-8000-000000000004',
    });
    expect(created).toEqual({
      displayName: 'Atendente Um',
      controlPlaneActorId: '00000000-0000-4000-8000-000000000004',
    });

    expect(parseCreateEmployeeDto({ displayName: 'Atendente' })).toEqual({
      displayName: 'Atendente',
    });

    expect(
      expectValidation(() =>
        parseCreateEmployeeDto({
          displayName: 'Atendente',
          password: 'x',
        }),
      ),
    ).toContainEqual({ field: 'password', rule: 'unknown_field' });

    expect(parseUpdateEmployeeDto({ active: false })).toEqual({
      active: false,
    });
    expect(
      parseUpdateEmployeeDto({ displayName: 'Novo', active: true }),
    ).toEqual({ displayName: 'Novo', active: true });

    expect(
      expectValidation(() => parseUpdateEmployeeDto({ active: 'yes' })),
    ).toContainEqual({ field: 'active', rule: 'invalid_value' });

    expect(
      expectValidation(() =>
        parseCreateEmployeeDto({ displayName: 'Atendente', active: 'x' }),
      ),
    ).toContainEqual({ field: 'active', rule: 'invalid_value' });
  });
});
