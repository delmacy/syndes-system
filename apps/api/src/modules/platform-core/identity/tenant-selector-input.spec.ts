import { hasClientTenantSelector } from './tenant-selector-input';

describe('client tenant-selector input rejection', () => {
  it('rejects selector fields in query, nested bodies, and routing headers', () => {
    expect(
      hasClientTenantSelector({}, { page: '1', tenant_id: 'tenant-b' }, {}),
    ).toBe(true);
    expect(
      hasClientTenantSelector({}, {}, { filters: [{ databaseName: 'db-b' }] }),
    ).toBe(true);
    expect(hasClientTenantSelector({ 'x-tenant-id': 'tenant-b' }, {}, {})).toBe(
      true,
    );
    expect(hasClientTenantSelector({ 'x-database-name': 'db-b' }, {}, {})).toBe(
      true,
    );
  });

  it('allows business fields and signed ingress metadata', () => {
    expect(
      hasClientTenantSelector(
        {
          'x-syndes-validated-host': 'crm.example.test',
          'x-syndes-validated-signature': 'signature',
        },
        { query: 'customer name', page: '2' },
        { organization: { name: 'Example', employee: 'Attendant' } },
      ),
    ).toBe(false);
  });

  it('fails closed on excessively nested selector payloads', () => {
    let nested: Record<string, unknown> = {};
    for (let index = 0; index < 34; index += 1) nested = { child: nested };
    expect(hasClientTenantSelector({}, {}, nested)).toBe(true);
  });
});
