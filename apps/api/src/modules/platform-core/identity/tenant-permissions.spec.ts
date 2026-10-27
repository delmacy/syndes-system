import { ForbiddenException } from '@nestjs/common';
import { assertTenantAction, allowsCustomerScope } from './tenant-permissions';
import type { TenantContext } from './identity.contracts';

const member: TenantContext = {
  actorId: 'a',
  tenantId: 't',
  databaseName: 'db',
  role: 'tenant_member',
  customerScope: 'pj',
};

describe('tenant authorization rules', () => {
  it.each(['read', 'create', 'update'] as const)(
    'allows tenant_member %s',
    (action) => {
      expect(() => assertTenantAction(member, action)).not.toThrow();
    },
  );

  it.each(['archive', 'export', 'manage_members'] as const)(
    'denies tenant_member %s',
    (action) => {
      expect(() => assertTenantAction(member, action)).toThrow(
        ForbiddenException,
      );
    },
  );

  it('keeps the fixed customer scope closed', () => {
    expect(allowsCustomerScope(member, 'pj')).toBe(true);
    expect(allowsCustomerScope(member, 'cpf')).toBe(false);
    expect(
      allowsCustomerScope({ ...member, customerScope: 'both' }, 'cpf'),
    ).toBe(true);
  });

  it('denies unknown roles by default', () => {
    expect(() =>
      assertTenantAction(
        { ...member, role: 'support' as TenantContext['role'] },
        'read',
      ),
    ).toThrow(ForbiddenException);
  });
});
