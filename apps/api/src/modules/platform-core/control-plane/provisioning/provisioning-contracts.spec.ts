import { randomUUID } from 'node:crypto';
import {
  PROVISIONING_FAILURE_CODES,
  PROVISIONING_STAGE_CODES,
  PROVISIONING_STATES,
  generateTenantRolePassword,
  isTransitionAllowed,
  isValidTenantUuid,
  quotePgIdentifier,
  quotePgLiteral,
  tenantAdvisoryLockKey,
  tenantDatabaseName,
  tenantDatabaseRoleName,
} from './provisioning-contracts';

describe('CRM-02 provisioning contracts', () => {
  describe('state machine', () => {
    it('allows exactly the CRM-00 lifecycle transitions', () => {
      expect(isTransitionAllowed('pending', 'in_progress')).toBe(true);
      expect(isTransitionAllowed('in_progress', 'ready')).toBe(true);
      expect(isTransitionAllowed('in_progress', 'failed')).toBe(true);
      expect(isTransitionAllowed('failed', 'in_progress')).toBe(true);
    });

    it('rejects every forbidden state transition', () => {
      expect(isTransitionAllowed('pending', 'ready')).toBe(false);
      expect(isTransitionAllowed('pending', 'failed')).toBe(false);
      expect(isTransitionAllowed('ready', 'ready')).toBe(false);
      expect(isTransitionAllowed('ready', 'in_progress')).toBe(false);
      expect(isTransitionAllowed('ready', 'failed')).toBe(false);
      expect(isTransitionAllowed('failed', 'ready')).toBe(false);
      expect(isTransitionAllowed('failed', 'failed')).toBe(false);
      expect(isTransitionAllowed('in_progress', 'in_progress')).toBe(false);
      expect(isTransitionAllowed('in_progress', 'pending')).toBe(false);
    });

    it('keeps the closed state, stage, and failure code sets', () => {
      expect(PROVISIONING_STATES).toEqual([
        'pending',
        'in_progress',
        'ready',
        'failed',
      ]);
      expect(PROVISIONING_STAGE_CODES).toEqual([
        'claimed',
        'database',
        'credential',
        'role',
        'migrations',
        'privileges',
        'ready',
      ]);
      expect(PROVISIONING_FAILURE_CODES).toEqual([
        'control_plane_update_failed',
        'database_create_failed',
        'credential_store_failed',
        'role_create_failed',
        'migration_failed',
        'privilege_grant_failed',
        'ready_update_failed',
        'database_name_mismatch',
      ]);
    });
  });

  describe('tenant resource names derive only from the permanent UUID', () => {
    const tenantId = randomUUID();

    it('generates the database name from the UUID', () => {
      const databaseName = tenantDatabaseName(tenantId);
      expect(databaseName).toBe(
        `sdb_${tenantId.toLowerCase().replaceAll('-', '')}`,
      );
      expect(databaseName).toMatch(/^sdb_[0-9a-f]{32}$/);
      expect(databaseName.length).toBeLessThanOrEqual(63);
    });

    it('generates the least-privilege role name from the UUID', () => {
      const roleName = tenantDatabaseRoleName(tenantId);
      expect(roleName).toBe(
        `tapp_${tenantId.toLowerCase().replaceAll('-', '')}`,
      );
      expect(roleName).toMatch(/^tapp_[0-9a-f]{32}$/);
    });

    it('is deterministic for a stable tenant UUID', () => {
      expect(tenantDatabaseName(tenantId)).toBe(tenantDatabaseName(tenantId));
      expect(tenantDatabaseRoleName(tenantId)).toBe(
        tenantDatabaseRoleName(tenantId),
      );
    });

    it('rejects non-UUID values instead of composing identifiers from them', () => {
      for (const bad of [
        '',
        'name',
        'db"; DROP TABLE tenants;--',
        `${randomUUID()}x`,
        randomUUID().replaceAll('-', ''),
      ]) {
        expect(() => tenantDatabaseName(bad)).toThrow();
        expect(() => tenantDatabaseRoleName(bad)).toThrow();
        expect(() => tenantAdvisoryLockKey(bad)).toThrow();
      }
    });
  });

  describe('PostgreSQL identifier and literal quoting', () => {
    it('validates and quotes generated identifiers safely', () => {
      expect(quotePgIdentifier('sdb_0f1e2d3c4b5a6978897a6b5c4d3e2f10')).toBe(
        '"sdb_0f1e2d3c4b5a6978897a6b5c4d3e2f10"',
      );
    });

    it('rejects arbitrary or malicious identifier values', () => {
      for (const bad of [
        'x; DROP TABLE tenants',
        'db name',
        'Upper_Case',
        '9starts_digit',
        '',
        '"quoted"',
        'a'.repeat(64),
      ]) {
        expect(() => quotePgIdentifier(bad)).toThrow();
      }
    });

    it('escapes literal quotes defensively in password literals', () => {
      expect(quotePgLiteral(`pass'word`)).toBe(`'pass''word'`);
    });
  });

  describe('credential and lock helpers', () => {
    it('generates a strong random password on each call', () => {
      const first = generateTenantRolePassword();
      const second = generateTenantRolePassword();
      expect(first).not.toBe(second);
      expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(first).not.toMatch(/['";]/);
    });

    it('derives a deterministic per-tenant advisory lock key within signed int64', () => {
      const tenantId = randomUUID();
      const key = tenantAdvisoryLockKey(tenantId);
      expect(key).toBe(tenantAdvisoryLockKey(tenantId));
      expect(key).toBeGreaterThanOrEqual(-(2n ** 63n));
      expect(key).toBeLessThan(2n ** 63n);
      expect(tenantAdvisoryLockKey(randomUUID())).not.toBe(key);
    });
  });

  it('validates UUID-shaped tenant identifiers only', () => {
    const tenantId = randomUUID();
    expect(isValidTenantUuid(tenantId)).toBe(true);
    expect(isValidTenantUuid(tenantId.toUpperCase())).toBe(true);
    expect(isValidTenantUuid('not-a-uuid')).toBe(false);
    expect(isValidTenantUuid(undefined)).toBe(false);
    expect(isValidTenantUuid(123)).toBe(false);
  });
});
