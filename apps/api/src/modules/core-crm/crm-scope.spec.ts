import { and, getTableColumns, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  crmEmployees,
  crmOrganizations,
  crmPeople,
  crmRelationships,
} from './tenant-crm.schema';
import type { Pool } from 'pg';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { personScopeCondition, organizationsInScope } from './crm-scope';

/** Offline query renderer: never opens a connection. */
const db = drizzle({ client: {} as Pool });

describe('Core CRM customer scope (CRM-05)', () => {
  const contexts: Record<string, TenantContext> = {
    admin: {
      actorId: 'a1',
      tenantId: 't1',
      databaseName: 'sdb_t1',
      role: 'tenant_admin',
      customerScope: 'both',
    },
    memberBoth: {
      actorId: 'a2',
      tenantId: 't1',
      databaseName: 'sdb_t1',
      role: 'tenant_member',
      customerScope: 'both',
    },
    memberCpf: {
      actorId: 'a3',
      tenantId: 't1',
      databaseName: 'sdb_t1',
      role: 'tenant_member',
      customerScope: 'cpf',
    },
    memberPj: {
      actorId: 'a4',
      tenantId: 't1',
      databaseName: 'sdb_t1',
      role: 'tenant_member',
      customerScope: 'pj',
    },
  };

  it('filters person visibility by the fixed customer scope', () => {
    expect(personScopeCondition(contexts.admin)).toBeUndefined();
    expect(personScopeCondition(contexts.memberBoth)).toBeUndefined();

    const cpf = db
      .select()
      .from(crmPeople)
      .where(personScopeCondition(contexts.memberCpf))
      .toSQL();
    expect(cpf.sql).toContain('NOT EXISTS');
    expect(cpf.sql).toContain('crm_relationships');
    expect(cpf.sql).toContain('person_id');

    const pj = db
      .select()
      .from(crmPeople)
      .where(personScopeCondition(contexts.memberPj))
      .toSQL();
    expect(pj.sql).toContain('EXISTS');
    expect(pj.sql).not.toContain('NOT EXISTS');
  });

  it('restricts organization surfaces to pj-scoped actors', () => {
    expect(organizationsInScope(contexts.admin)).toBe(true);
    expect(organizationsInScope(contexts.memberBoth)).toBe(true);
    expect(organizationsInScope(contexts.memberPj)).toBe(true);
    expect(organizationsInScope(contexts.memberCpf)).toBe(false);
  });

  it('declares the tenant CRM tables with the reviewed columns', () => {
    expect(Object.keys(getTableColumns(crmOrganizations))).toEqual([
      'id',
      'name',
      'cnpj',
      'email',
      'phone',
      'archivedAt',
      'createdAt',
      'updatedAt',
    ]);
    expect(Object.keys(getTableColumns(crmPeople))).toEqual([
      'id',
      'fullName',
      'cpf',
      'email',
      'phone',
      'archivedAt',
      'createdAt',
      'updatedAt',
    ]);
    expect(Object.keys(getTableColumns(crmRelationships))).toEqual([
      'personId',
      'organizationId',
      'role',
      'createdAt',
      'updatedAt',
    ]);
    expect(Object.keys(getTableColumns(crmEmployees))).toEqual([
      'id',
      'displayName',
      'active',
      'controlPlaneActorId',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('has no credential-shaped column anywhere (Employee is not a login)', () => {
    for (const table of [
      crmEmployees,
      crmOrganizations,
      crmPeople,
      crmRelationships,
    ]) {
      const names = Object.keys(getTableColumns(table));
      const secretShaped = names.filter((name) =>
        /password|secret|token|credential|api_key|connection|login/i.test(name),
      );
      expect(secretShaped).toEqual([]);
    }
  });

  it('combines scope and archived filters safely', () => {
    const combined = and(
      personScopeCondition(contexts.memberCpf),
      and(sqlOfArchived()),
    );
    const rendered = db.select().from(crmPeople).where(combined).toSQL();
    expect(rendered.sql).toContain('crm_relationships');
    expect(rendered.sql).toContain('NOT EXISTS');
    expect(rendered.sql).toContain('archived_at');
  });
});

function sqlOfArchived() {
  return sql`${crmPeople.archivedAt} IS NULL`;
}
