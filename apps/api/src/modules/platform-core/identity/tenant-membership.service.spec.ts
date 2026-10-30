import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
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
const adminOfTenantB: TenantContext = { ...admin, tenantId: 'tenant-b' };

interface QueryCall {
  sql: string;
  values?: unknown[];
}

function setup(results: Array<{ rows?: unknown[]; rowCount?: number }> = []) {
  const calls: QueryCall[] = [];
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

function setupWithFailingInsert(insertError: Error) {
  const calls: QueryCall[] = [];
  const query = jest.fn((sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes('INSERT INTO tenant_memberships')) {
      return Promise.reject(insertError);
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
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
      { rows: [], rowCount: 0 },
      {
        rows: [
          { actor_id: 'new-actor', customer_scope: 'pj', status: 'active' },
        ],
        rowCount: 1,
      },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    await expect(
      service.grantMember(admin, 'new-actor', 'pj'),
    ).resolves.toEqual({
      actorId: 'new-actor',
      role: 'tenant_member',
      customerScope: 'pj',
      status: 'active',
    });
    expect(calls[1].sql).toContain('INSERT INTO tenant_memberships');
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

  it('returns the stable actor_not_found problem when the actor is not provisioned', async () => {
    const { service, calls } = setup([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    const error = await service.grantMember(admin, 'missing-actor', 'cpf').then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual(
      expect.objectContaining({
        code: 'actor_not_found',
        statusCode: HttpStatus.NOT_FOUND,
      }),
    );
    expect(calls.map((call) => call.sql)).toContain('ROLLBACK');
  });

  it('maps a duplicate membership grant to the stable membership_exists conflict', async () => {
    const conflictError = new Error(
      'duplicate key value violates unique constraint',
    );
    (conflictError as NodeJS.ErrnoException).code = '23505';
    const { service, calls } = setupWithFailingInsert(conflictError);
    const error = await service.grantMember(admin, 'actor-a', 'pj').then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(
      expect.objectContaining({
        code: 'membership_exists',
        statusCode: HttpStatus.CONFLICT,
      }),
    );
    expect(calls.map((call) => call.sql)).toContain('ROLLBACK');
  });

  it('updates and revokes only active member rows in the caller tenant', async () => {
    const update = setup([
      { rows: [], rowCount: 0 },
      {
        rows: [
          { actor_id: 'member-a', customer_scope: 'cpf', status: 'active' },
        ],
        rowCount: 1,
      },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    await expect(
      update.service.updateMemberScope(admin, 'member-a', 'cpf'),
    ).resolves.toMatchObject({ customerScope: 'cpf' });
    expect(update.calls[1].sql).toContain(
      "WHERE tenant_id = $1 AND actor_id = $2 AND role = 'tenant_member'",
    );
    expect(update.calls[1].values).toEqual(['tenant-a', 'member-a', 'cpf']);

    const revoke = setup([
      { rows: [{ actor_id: 'member-a' }], rowCount: 1 },
      { rows: [{ actor_id: 'member-a' }], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    await expect(
      revoke.service.revokeMember(admin, 'member-a'),
    ).resolves.toBeUndefined();
    expect(revoke.calls[1].sql).toContain("SET status = 'revoked'");
    expect(revoke.calls[1].values).toEqual(['tenant-a', 'member-a']);
    expect(revoke.calls[2].sql).toContain('INSERT INTO audit_events');
    expect(revoke.calls[2].values).toEqual([
      'tenant-a',
      'admin-actor',
      'tenant.membership.revoke',
      'member-a',
    ]);
    expect(revoke.calls[3].sql).toBe('COMMIT');
  });

  it('refuses to revoke a membership that is not active', async () => {
    const { service, calls } = setup([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    const error = await service.revokeMember(admin, 'member-inactive').then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect(calls.map((call) => call.sql)).toContain('ROLLBACK');
  });

  it('denies tenant members from granting, listing, updating or revoking memberships', async () => {
    const grantDenied = setup();
    await expect(
      grantDenied.service.grantMember(member, 'actor-a', 'pj'),
    ).rejects.toThrow(ForbiddenException);
    expect(grantDenied.connect).not.toHaveBeenCalled();

    const listDenied = setup();
    await expect(listDenied.service.listMembers(member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(listDenied.connect).not.toHaveBeenCalled();

    const updateDenied = setup();
    await expect(
      updateDenied.service.updateMemberScope(member, 'actor-a', 'pj'),
    ).rejects.toThrow(ForbiddenException);
    expect(updateDenied.connect).not.toHaveBeenCalled();

    const revokeDenied = setup();
    await expect(
      revokeDenied.service.revokeMember(member, 'actor-a'),
    ).rejects.toThrow(ForbiddenException);
    expect(revokeDenied.connect).not.toHaveBeenCalled();
  });

  it('scopes membership mutations to the caller tenant context', async () => {
    const grant = setup([
      { rows: [], rowCount: 0 },
      {
        rows: [
          { actor_id: 'actor-b', customer_scope: 'both', status: 'active' },
        ],
        rowCount: 1,
      },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    await expect(
      grant.service.grantMember(adminOfTenantB, 'actor-b', 'both'),
    ).resolves.toMatchObject({ actorId: 'actor-b', status: 'active' });
    expect(grant.calls[1].values).toEqual(['tenant-b', 'actor-b', 'both']);

    const revoke = setup([
      { rows: [{ actor_id: 'member-a' }], rowCount: 1 },
      { rows: [{ actor_id: 'member-a' }], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ]);
    await revoke.service.revokeMember(adminOfTenantB, 'member-a');
    expect(revoke.calls[1].values).toEqual(['tenant-b', 'member-a']);
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
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
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
