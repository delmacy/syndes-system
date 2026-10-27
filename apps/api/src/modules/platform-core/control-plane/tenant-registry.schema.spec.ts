import { getTableName, getTableColumns } from 'drizzle-orm';
import { PROVISIONING_STATES, tenants } from './tenant-registry.schema';

describe('Control Plane tenant registry schema (CRM-01)', () => {
  it('exposes the approved provisioning states as a closed set', () => {
    expect(PROVISIONING_STATES).toEqual([
      'pending',
      'in_progress',
      'ready',
      'failed',
    ]);
  });

  it('registers the tenants table with its permanent uuid identity', () => {
    expect(getTableName(tenants)).toBe('tenants');
    expect(tenants.id.name).toBe('id');
    expect(tenants.id.columnType).toBe('PgUUID');
    expect(tenants.id.notNull).toBe(true);
    expect(tenants.id.hasDefault).toBe(true);
  });

  it('stores database_name as the unique non-secret reference and never credentials', () => {
    expect(tenants.databaseName.name).toBe('database_name');
    expect(tenants.databaseName.notNull).toBe(true);
    expect(tenants.databaseName.isUnique).toBe(true);
    expect(tenants.databaseName.hasDefault).toBe(false);
  });

  it('defaults new tenants to the pending provisioning state', () => {
    expect(tenants.provisioningState.name).toBe('provisioning_state');
    expect(tenants.provisioningState.notNull).toBe(true);
    expect(tenants.provisioningState.hasDefault).toBe(true);
    expect(tenants.provisioningState.enumValues).toEqual(PROVISIONING_STATES);
  });

  it('declares timestamp columns with timezone for created_at and updated_at', () => {
    for (const key of ['createdAt', 'updatedAt'] as const) {
      expect(tenants[key].columnType).toBe('PgTimestamp');
      expect(tenants[key].name.endsWith('_at')).toBe(true);
      expect(tenants[key].notNull).toBe(true);
      expect(tenants[key].hasDefault).toBe(true);
      expect(tenants[key].withTimezone).toBe(true);
    }
  });

  it('exposes exactly the approved registry columns with no secret-shaped column', () => {
    const columnNames = Object.keys(getTableColumns(tenants));
    expect(columnNames).toEqual([
      'id',
      'displayName',
      'databaseName',
      'provisioningState',
      'createdAt',
      'updatedAt',
    ]);
    const secretShaped = columnNames.filter((name) =>
      /password|secret|token|credential|api_key|connection/i.test(name),
    );
    expect(secretShaped).toEqual([]);
  });
});
