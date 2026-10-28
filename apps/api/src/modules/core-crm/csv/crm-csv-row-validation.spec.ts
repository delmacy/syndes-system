import { csvScopeRowCode, validateCsvRow } from './csv-row-validation';

describe('CSV row validation (CRM-08)', () => {
  it('accepts rows that satisfy the canonical CRM create rules', () => {
    expect(
      validateCsvRow('person', {
        fullName: 'Maria, Silva',
        cpf: '123.456.789-00',
        email: 'maria@example.com',
        phone: '11912345678',
      }).code,
    ).toBeUndefined();
    expect(
      validateCsvRow('organization', {
        name: 'Organização Alfa',
        cnpj: '12.345.678/0001-00',
        email: 'contato@alfa.test',
        phone: '+55 11 4000-0000',
      }).code,
    ).toBeUndefined();
  });

  it('rejects control characters the CRM API would reject', () => {
    expect(
      validateCsvRow('person', { fullName: 'Maria\u001bSilva' }).code,
    ).toBe('invalid_name');
    expect(validateCsvRow('organization', { name: 'Al\u0007fa' }).code).toBe(
      'invalid_name',
    );
    expect(
      validateCsvRow('person', { fullName: 'Maria', email: 'a@b\u001b.c' })
        .code,
    ).toBe('invalid_email');
    expect(
      validateCsvRow('person', { fullName: 'Maria', phone: '11\u001b999' })
        .code,
    ).toBe('invalid_phone');
  });

  it('rejects emails the CRM API would reject', () => {
    expect(
      validateCsvRow('person', { fullName: 'Maria', email: 'a@b@c.d' }).code,
    ).toBe('invalid_email');
    expect(
      validateCsvRow('person', { fullName: 'Maria', email: 'invalido' }).code,
    ).toBe('invalid_email');
  });

  it('rejects missing names and malformed documents', () => {
    expect(validateCsvRow('person', {}).code).toBe('invalid_name');
    expect(validateCsvRow('organization', { name: '' }).code).toBe(
      'invalid_name',
    );
    expect(
      validateCsvRow('person', { fullName: 'Maria', cpf: 'abc' }).code,
    ).toBe('invalid_cpf');
    expect(
      validateCsvRow('organization', { name: 'Alfa', cnpj: 'abc' }).code,
    ).toBe('invalid_cnpj');
  });

  it('normalizes the stored row to the canonical CRM representation', () => {
    const result = validateCsvRow('person', {
      fullName: '  Maria Silva  ',
      email: 'maria@example.com',
      organizationId: '00000000-0000-4000-8000-00000000000A',
    });
    expect(result.values?.fullName).toBe('Maria Silva');
    expect(result.values?.organizationId).toBe(
      '00000000-0000-4000-8000-00000000000a',
    );
  });

  it('applies the customer scope rules before row validation', () => {
    expect(csvScopeRowCode('person', 'pj', { fullName: 'Contato' })).toBe(
      'organization_required_for_scope',
    );
    expect(
      csvScopeRowCode('person', 'cpf', {
        fullName: 'Contato',
        organizationId: '00000000-0000-4000-8000-00000000000a',
      }),
    ).toBe('organization_outside_scope');
    expect(
      csvScopeRowCode('person', 'both', { fullName: 'Contato' }),
    ).toBeUndefined();
    expect(
      csvScopeRowCode('organization', 'cpf', { name: 'Alfa' }),
    ).toBeUndefined();
  });

  it('treats blank optional cells as absent', () => {
    const person = validateCsvRow('person', {
      fullName: 'Maria Silva',
      cpf: '',
      email: '',
      phone: '   ',
      organizationId: '',
    });
    expect(person.code).toBeUndefined();
    expect(person.values).toEqual({ fullName: 'Maria Silva' });

    const organization = validateCsvRow('organization', {
      name: 'Organização Alfa',
      cnpj: '',
      email: '',
      phone: '',
    });
    expect(organization.code).toBeUndefined();
    expect(organization.values).toEqual({ name: 'Organização Alfa' });
  });

  it('still rejects a blank required name', () => {
    expect(validateCsvRow('person', { fullName: '' }).code).toBe(
      'invalid_name',
    );
    expect(validateCsvRow('person', { fullName: '   ' }).code).toBe(
      'invalid_name',
    );
    expect(
      validateCsvRow('person', { fullName: '', email: 'maria@example.com' })
        .code,
    ).toBe('invalid_name');
    expect(validateCsvRow('organization', { name: '' }).code).toBe(
      'invalid_name',
    );
    expect(validateCsvRow('organization', { name: '   ', cnpj: '' }).code).toBe(
      'invalid_name',
    );
  });

  it('keeps rejecting invalid values that are not blank', () => {
    expect(
      validateCsvRow('person', { fullName: 'Maria', email: 'invalido' }).code,
    ).toBe('invalid_email');
    expect(
      validateCsvRow('person', { fullName: 'Maria', cpf: 'abc' }).code,
    ).toBe('invalid_cpf');
    expect(
      validateCsvRow('organization', { name: 'Alfa', cnpj: 'abc' }).code,
    ).toBe('invalid_cnpj');
  });

  it('preserves the presentation of CPF and CNPJ values', () => {
    const person = validateCsvRow('person', {
      fullName: 'Maria Silva',
      cpf: ' 123.456.789-00 ',
    });
    expect(person.values?.cpf).toBe('123.456.789-00');
    const organization = validateCsvRow('organization', {
      name: 'Organização Alfa',
      cnpj: '12.345.678/0001-00',
    });
    expect(organization.values?.cnpj).toBe('12.345.678/0001-00');
  });
});
