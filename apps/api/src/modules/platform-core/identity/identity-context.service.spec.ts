import { NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { IdentityContextService } from './identity-context.service';

describe('identity context resolution', () => {
  it('routes only by normalized validated host and active membership', async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          tenant_id: 'tenant-1',
          database_name: 'sdb_tenant',
          role: 'tenant_member',
          customer_scope: 'pj',
        },
      ],
    });
    const service = new IdentityContextService({ query } as unknown as Pool);

    await expect(
      service.resolveTenantContext('actor-1', 'CRM.Example.Test.'),
    ).resolves.toEqual({
      actorId: 'actor-1',
      tenantId: 'tenant-1',
      databaseName: 'sdb_tenant',
      role: 'tenant_member',
      customerScope: 'pj',
    });

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("d.status = 'active'");
    expect(sql).toContain("m.status = 'active'");
    expect(sql).toContain("t.provisioning_state = 'ready'");
    expect(values).toEqual(['crm.example.test', 'actor-1']);
  });

  it('denies actors without an active membership in the mapped tenant', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const service = new IdentityContextService({ query } as unknown as Pool);
    await expect(
      service.resolveTenantContext('actor-1', 'crm.example.test'),
    ).rejects.toThrow(NotFoundException);
  });
});
