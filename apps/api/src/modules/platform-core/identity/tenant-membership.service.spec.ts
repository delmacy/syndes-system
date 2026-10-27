import type { Pool, PoolClient } from 'pg';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantMembershipService } from './tenant-membership.service';
import type { TenantContext } from './identity.contracts';

const admin: TenantContext = {
  actorId: 'admin-actor',
  tenantId: 'tenant-a',
  databaseName: 'db-a',
  role: 'tenant_admin',
  customerScope: 'both',
};
const member: TenantContext = {
  ...admin,
  role: 'tenant_member',
  customerScope: 'pj',
};

function setup(results: Array<{ rows?: unknown[]; rowCount?: number }> = []) {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const query = jest.fn((sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    return Promise.resolve(results.shift() ?? { rows: [], rowCount: 0 });
  });
  const release = jest.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = jest.fn().mockResolvedValue(client);
  const service = new TenantMembershipService({ connect } as unknown as Pool);
  return { service, calls, release, connect };
}

describe('tenant membership manager contract', () => {
  it('grants only tenant_member with a fixed scope and commits its audit event atomically', async () => {
    const { service, calls, release } = setup([
      { rows: [], rowCount: null },
      {
        rows: [
          { actor_id: 'new-actor', customer_scope: 'pj', status: 'active' },
        ],
        rowCount: 1,
      },
      { rows: [], rowCount: null },
      { rows: [], rowCount: null },
    ]);
    await expect(
      service.grantMember(admin, 'new-actor', 'pj'),
    ).resolves.toEqual({
      actorId: 'new-actor',
      role: 'tenant_member',
      customerScope: 'pj',
      status: 'active',
    });
    expect(calls[1].sql).toContain("SELECT $1, a.id, 'tenant_member'");
    expect(calls[1].values).toEqual(['tenant-a', 'new-actor', 'pj']);
    expect(calls[2].sql).toContain('INSERT INTO audit_events');
    expect(calls[2].values).toEqual([
      'tenant-a',
      'admin-actor',
      'tenant.membership.grant',
      'new-actor',
    ]);
    expect(calls[3].sql).toBe('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('updates and revokes only active member rows in the caller tenant', async () => {
    const update = setup([
      { rows: [], rowCount: null },
      {
        rows: [
          { actor_id: 'member-a', customer_scope: 'cpf', status: 'active' },
        ],
        rowCount: 1,
      },
      { rows: [], rowCount: null },
      { rows: [], rowCount: null },
    ]);
    await expect(
      update.service.updateMemberScope(admin, 'member-a', 'cpf'),
    ).resolves.toMatchObject({ customerScope: 'cpf' });
    expect(update.calls[1].sql).toContain(
      "WHERE tenant_id = $1 AND actor_id = $2 AND role = 'tenant_member'",
    );
    expect(update.calls[1].values).toEqual(['tenant-a', 'member-a', 'cpf']);

    const revoke = setup([
      { rows: [], rowCount: null },
      { rows: [{ actor_id: 'member-a' }], rowCount: 1 },
      { rows: [], rowCount: null },
      { rows: [], rowCount: null },
    ]);
    await expect(
      revoke.service.revokeMember(admin, 'member-a'),
    ).resolves.toBeUndefined();
    expect(revoke.calls[1].sql).toContain("SET status = 'revoked'");
    expect(revoke.calls[1].values).toEqual(['tenant-a', 'member-a']);
  });

  it('denies tenant members, unknown scopes, and cross-tenant membership changes', async () => {
    const forbidden = setup();
    await expect(
      forbidden.service.revokeMember(member, 'other'),
    ).rejects.toThrow(ForbiddenException);
    expect(forbidden.connect).not.toHaveBeenCalled();

    const invalidScope = setup();
    await expect(
      invalidScope.service.updateMemberScope(
        admin,
        'member-a',
        'support' as never,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(invalidScope.connect).not.toHaveBeenCalled();

    const missing = setup([
      { rows: [], rowCount: null },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: null },
    ]);
    await expect(
      missing.service.updateMemberScope(admin, 'member-from-b', 'pj'),
    ).rejects.toThrow(NotFoundException);
    expect(missing.calls[1].values).toEqual([
      'tenant-a',
      'member-from-b',
      'pj',
    ]);
    expect(missing.calls.map((call) => call.sql)).toContain('ROLLBACK');
  });
});
