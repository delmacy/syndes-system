import { HttpStatus } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import {
  TenantProvisioningError,
  TenantProvisioningNotFoundError,
  TenantProvisioningService,
} from '../control-plane/provisioning/tenant-provisioning.service';
import type { AuditService } from '../identity/audit.service';
import { parseCreateTenantDto, parseTenantIdParam } from './manager-dtos';
import { ManagerProblemException } from './manager-problem-details';
import { ManagerTenantsService } from './manager-tenants.service';

const configuredIssuer = 'https://id.test/realms/syndes';

interface Harness {
  service: ManagerTenantsService;
  pool: { connect: jest.Mock; query: jest.Mock };
  provisioning: { provision: jest.Mock; describe: jest.Mock };
  audit: { record: jest.Mock };
  queries: { sql: string; values: unknown[] }[];
}

function harness(
  clientResults: {
    match: (sql: string) => boolean;
    result: unknown;
  }[] = [],
): Harness {
  const queries: { sql: string; values: unknown[] }[] = [];
  const resolve = (
    sql: string,
    clientResults: {
      match: (sql: string) => boolean;
      result: unknown;
    }[],
  ): Promise<{ rowCount: number; rows: unknown[] }> => {
    const match = clientResults.find((entry) => entry.match(sql));
    if (!match) return Promise.resolve({ rowCount: 0, rows: [] });
    if (typeof match.result === 'function') {
      const dynamic = match.result as () => Promise<{
        rowCount: number;
        rows: unknown[];
      }>;
      return dynamic();
    }
    return Promise.resolve(match.result);
  };
  const client = {
    query: jest.fn((sql: string, values?: unknown[]) => {
      queries.push({ sql, values: values ?? [] });
      return resolve(sql, clientResults);
    }),
    release: jest.fn(),
  };
  const pool = {
    connect: jest.fn(() => Promise.resolve(client as unknown as PoolClient)),
    query: jest.fn((sql: string, values?: unknown[]) => {
      queries.push({ sql, values: values ?? [] });
      return resolve(sql, clientResults);
    }),
  };
  const provisioning = {
    provision: jest.fn(() =>
      Promise.reject(new TenantProvisioningNotFoundError()),
    ),
    describe: jest.fn(() => Promise.resolve(null)),
  };
  const audit = { record: jest.fn(() => Promise.resolve()) };
  const service = new ManagerTenantsService(
    pool as unknown as Pool,
    provisioning as unknown as TenantProvisioningService,
    audit as unknown as AuditService,
    configuredIssuer,
  );
  return { service, pool, provisioning, audit, queries };
}

function rows(result: unknown): { rows: unknown[]; rowCount: number } {
  return result as { rows: unknown[]; rowCount: number };
}

const tenantRow = {
  id: '0f2b823f-2eab-4e8a-93f5-23a0e9dc6f92',
  display_name: 'Tenant A',
  provisioning_state: 'pending',
  created_at: new Date(0),
  updated_at: new Date(0),
};

describe('CRM-04 manager tenants service', () => {
  describe('list', () => {
    it('applies bounded pagination and returns the CRM-04 envelope', async () => {
      const h = harness();
      h.pool.query.mockImplementation((sql: string) => {
        if (sql.includes('count(*)')) {
          return Promise.resolve(rows({ rows: [{ total: '1' }], rowCount: 1 }));
        }
        return Promise.resolve(rows({ rows: [tenantRow], rowCount: 1 }));
      });

      const result = await h.service.list({ page: 2, pageSize: 25 });

      expect(result).toMatchObject({
        page: 2,
        pageSize: 25,
        total: 1,
      });
      expect(result.items[0]).toEqual({
        id: tenantRow.id,
        displayName: 'Tenant A',
        provisioningState: 'pending',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      });
      const calls = h.pool.query.mock.calls as unknown as [string, unknown[]][];
      const call = calls.find(([sql]) => sql.includes('LIMIT')) ?? ['', []];
      const [sql, values] = call;
      expect(sql).toContain('ORDER BY created_at DESC, id');
      expect(values).toEqual([25, 25]);
    });

    it('never selects tenant database names, credentials, or CRM content', async () => {
      const h = harness();
      await h.service.list({ page: 1, pageSize: 20 });
      for (const { sql } of h.queries) {
        expect(sql).not.toContain('database_name');
        expect(sql).not.toContain('tenant_memberships');
        expect(sql).not.toContain('SELECT *');
      }
    });
  });

  describe('getDetail', () => {
    it('returns sanitized provisioning state without database references', async () => {
      const h = harness([
        {
          match: (sql) => sql.includes('LEFT JOIN tenant_provisioning'),
          result: rows({
            rows: [
              {
                ...tenantRow,
                stage: 'ready',
                failure_code: null,
                attempt: 2,
              },
            ],
            rowCount: 1,
          }),
        },
      ]);

      const detail = await h.service.getDetail(
        parseTenantIdParam(tenantRow.id),
      );

      expect(detail).toMatchObject({
        id: tenantRow.id,
        provisioning: { stage: 'ready', failureCode: null, attempt: 2 },
      });
      expect(JSON.stringify(detail)).not.toContain('database_name');
      expect(JSON.stringify(detail)).not.toContain('sdb_');
    });

    it('reports unknown tenants as 404 without existence confirmation leaks', async () => {
      const h = harness();
      await expect(
        h.service.getDetail(parseTenantIdParam(tenantRow.id)),
      ).rejects.toThrow(
        new ManagerProblemException({
          code: 'tenant_not_found',
          statusCode: HttpStatus.NOT_FOUND,
          detail: 'Tenant not found.',
        }),
      );
    });
  });

  describe('create', () => {
    it('inserts a permanent UUID tenant with a UUID-derived server-side database name', async () => {
      const h = harness();
      h.pool.connect.mockImplementation(() => {
        const client = {
          query: jest.fn((sql: string) => {
            h.queries.push({ sql, values: [] as never });
            if (sql.includes('INSERT INTO tenants')) {
              return Promise.resolve(
                rows({
                  rows: [{ ...tenantRow, display_name: 'New tenant' }],
                  rowCount: 1,
                }),
              );
            }
            return Promise.resolve(rows({ rows: [], rowCount: 1 }));
          }),
          release: jest.fn(),
        } as PoolClient;
        return Promise.resolve(client);
      });

      const created = await h.service.create(
        parseCreateTenantDto({ displayName: 'New tenant' }),
        'actor-1',
      );

      expect(created.displayName).toBe('New tenant');
      expect(created.provisioningState).toBe('pending');
      const insertQuery = h.queries.find(({ sql }) =>
        sql.includes('INSERT INTO tenants'),
      )!;
      expect(insertQuery.sql).toContain("VALUES ($1, $2, $3, 'pending')");
      expect(h.queries.some(({ sql }) => sql.includes('audit_events'))).toBe(
        true,
      );
    });

    it('rolls back and audits atomically when the audit write fails', async () => {
      const h = harness([
        {
          match: (sql) => sql.includes('audit_events'),
          result: () => Promise.reject(new Error('audit write refused')),
        },
        {
          match: (sql) => sql.includes('INSERT INTO tenants'),
          result: rows({ rows: [tenantRow], rowCount: 1 }),
        },
      ]);

      await expect(
        h.service.create(
          parseCreateTenantDto({ displayName: 'Audit tenant' }),
          'actor-1',
        ),
      ).rejects.toThrow('audit write refused');
      expect(h.queries.some(({ sql }) => sql === 'ROLLBACK')).toBe(true);
    });
  });

  describe('updateMetadata', () => {
    it('updates only the display name and audits the change', async () => {
      const h = harness([
        {
          match: (sql) => sql.includes('UPDATE tenants'),
          result: rows({
            rows: [{ ...tenantRow, display_name: 'Renamed' }],
            rowCount: 1,
          }),
        },
      ]);

      const updated = await h.service.updateMetadata(
        parseTenantIdParam(tenantRow.id),
        { displayName: 'Renamed' },
        'actor-1',
      );

      expect(updated.displayName).toBe('Renamed');
      const sqls = h.queries.map(({ sql }) => sql);
      expect(sqls.some((sql) => sql.includes('SET display_name = $2'))).toBe(
        true,
      );
      expect(sqls.some((sql) => sql.includes('audit_events'))).toBe(true);
      expect(sqls.every((sql) => !sql.includes('database_name'))).toBe(true);
    });

    it('rejects metadata updates for unknown tenants with 404', async () => {
      const h = harness();
      await expect(
        h.service.updateMetadata(
          parseTenantIdParam(tenantRow.id),
          { displayName: 'x' },
          'a',
        ),
      ).rejects.toThrow(ManagerProblemException);
    });
  });

  describe('startOrRetryProvisioning', () => {
    it('delegates to the idempotent CRM-02 provisioning service and reports state', async () => {
      const h = harness([
        {
          match: (sql) => sql.includes('LEFT JOIN tenant_provisioning'),
          result: rows({
            rows: [
              {
                ...tenantRow,
                provisioning_state: 'ready',
                stage: 'ready',
                failure_code: null,
                attempt: 1,
              },
            ],
            rowCount: 1,
          }),
        },
      ]);
      h.provisioning.provision.mockResolvedValue({
        tenantId: tenantRow.id,
        state: 'ready',
        alreadyReady: true,
      });

      const detail = await h.service.startOrRetryProvisioning(
        tenantRow.id,
        'actor-1',
      );

      expect(h.provisioning.provision).toHaveBeenCalledWith(tenantRow.id);
      expect(detail.provisioningState).toBe('ready');
      expect(h.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.provisioning.attempt',
          result: 'success',
        }),
      );
    });

    it('maps sanitized provisioning failures to problem details without secrets', async () => {
      const h = harness();
      h.provisioning.provision.mockRejectedValue(
        new TenantProvisioningError('migrations', 'migration_failed'),
      );
      h.audit.record.mockResolvedValue(undefined);

      const rejected = await h.service
        .startOrRetryProvisioning(tenantRow.id, 'actor-1')
        .catch((error: unknown) => error);

      expect(rejected).toBeInstanceOf(ManagerProblemException);
      const problem = rejected as ManagerProblemException;
      expect(problem.getResponse()).toMatchObject({
        code: 'provisioning_failed',
        statusCode: 502,
        extra: { stage: 'migrations', failureCode: 'migration_failed' },
      });
      expect(h.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.provisioning.attempt',
          result: 'failure',
        }),
      );
    });

    it('reports unknown tenants as 404 on provisioning start/retry', async () => {
      const h = harness();
      h.provisioning.provision.mockRejectedValue(
        new TenantProvisioningNotFoundError(),
      );
      await expect(
        h.service.startOrRetryProvisioning(tenantRow.id, 'actor-1'),
      ).rejects.toMatchObject({ message: 'Tenant not found.' });
    });
  });

  describe('assignInitialAdmin', () => {
    function membershipHarness(
      overrides: {
        tenantState?: string;
        actorFound?: boolean;
        insertError?: unknown;
      } = {},
    ): Harness {
      return harness([
        {
          match: (sql) =>
            sql.includes('SELECT provisioning_state FROM tenants'),
          result: rows({
            rows: [
              {
                provisioning_state: overrides.tenantState ?? 'ready',
              },
            ],
            rowCount: 1,
          }),
        },
        {
          match: (sql) => sql.includes('SELECT id FROM identity_actors'),
          result: rows({
            rows:
              overrides.actorFound === false ? [] : [{ id: 'actor-target' }],
            rowCount: overrides.actorFound === false ? 0 : 1,
          }),
        },
        {
          match: (sql) => sql.includes('INSERT INTO tenant_memberships'),
          result:
            overrides.insertError instanceof Error
              ? () =>
                  Promise.reject(
                    new Error(overrides.insertError!.message as string),
                  )
              : rows({
                  rows: [
                    {
                      tenant_id: tenantRow.id,
                      actor_id: 'actor-target',
                      customer_scope: 'both',
                      status: 'active',
                    },
                  ],
                  rowCount: 1,
                }),
        },
      ]);
    }

    const baseInput = {
      issuer: configuredIssuer,
      subject: 'subject-1',
    };

    it('grants the initial tenant_admin membership to the exact configured issuer + subject', async () => {
      const h = membershipHarness();

      const member = await h.service.assignInitialAdmin(
        tenantRow.id,
        baseInput,
        'actor-admin',
      );

      expect(member).toEqual({
        tenantId: tenantRow.id,
        actorId: 'actor-target',
        role: 'tenant_admin',
        customerScope: 'both',
        status: 'active',
      });
      expect(h.queries.some(({ sql }) => sql.includes('audit_events'))).toBe(
        true,
      );
      const insert = h.queries.find(({ sql }) =>
        sql.includes('INSERT INTO tenant_memberships'),
      )!;
      expect(insert.sql).toContain("'tenant_admin'");
    });

    it('requires the exact configured issuer and never accepts another realm', async () => {
      const h = membershipHarness();
      await expect(
        h.service.assignInitialAdmin(
          tenantRow.id,
          { issuer: 'https://other.test/realms/other', subject: 'subject-1' },
          'actor-admin',
        ),
      ).rejects.toThrow(ManagerProblemException);
      expect(h.pool.connect).not.toHaveBeenCalled();
    });

    it('resolves an existing actor only; missing identities are 404', async () => {
      const h = membershipHarness({ actorFound: false });
      const error = await h.service
        .assignInitialAdmin(tenantRow.id, baseInput, 'actor-admin')
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ManagerProblemException);
      expect((error as Error).message).toContain('identity actor');
      expect(
        h.queries.some(({ sql }) =>
          sql.includes('INSERT INTO tenant_memberships'),
        ),
      ).toBe(false);
    });

    it('denies assignment before tenant provisioning with 409', async () => {
      const h = membershipHarness({ tenantState: 'pending' });
      const error = await h.service
        .assignInitialAdmin(tenantRow.id, baseInput, 'actor-admin')
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ManagerProblemException);
      expect((error as Error).message).toContain('provisioning');
    });

    it('denies assignment for unknown tenants with 404', async () => {
      const h = harness([
        {
          match: (sql) =>
            sql.includes('SELECT provisioning_state FROM tenants'),
          result: rows({ rows: [], rowCount: 0 }),
        },
      ]);
      await expect(
        h.service.assignInitialAdmin(tenantRow.id, baseInput, 'actor-admin'),
      ).rejects.toMatchObject({ message: 'Tenant not found.' });
    });

    it('maps duplicate memberships to a 409 problem', async () => {
      const conflicting = new Error('duplicate key');
      (conflicting as NodeJS.ErrnoException).code = '23505';
      const h = membershipHarness({ insertError: conflicting });
      h.pool.connect.mockImplementation(() => {
        return Promise.resolve({
          query: jest.fn((sql: string) => {
            h.queries.push({ sql, values: [] as never });
            if (sql.includes('INSERT INTO tenant_memberships')) {
              return Promise.reject(conflicting);
            }
            if (sql.includes('INSERT INTO audit_events')) {
              return Promise.resolve({ rowCount: 1, rows: [] });
            }
            if (sql.includes('SELECT id FROM identity_actors')) {
              return Promise.resolve(
                rows({ rows: [{ id: 'actor-target' }], rowCount: 1 }),
              );
            }
            return Promise.resolve(
              rows({ rows: [{ provisioning_state: 'ready' }], rowCount: 1 }),
            );
          }),
          release: jest.fn(),
        } as PoolClient);
      });
      await expect(
        h.service.assignInitialAdmin(tenantRow.id, baseInput, 'actor-admin'),
      ).rejects.toMatchObject({
        message: 'A membership already exists for this identity and tenant.',
      });
      expect(h.queries.some(({ sql }) => sql.includes('ROLLBACK'))).toBe(true);
    });
  });
});
