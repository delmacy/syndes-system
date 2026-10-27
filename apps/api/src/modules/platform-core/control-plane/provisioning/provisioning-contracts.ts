import { createHash, randomBytes } from 'node:crypto';

/**
 * Pure CRM-02 provisioning contracts shared by the runtime service, tests,
 * and CI verification tools.
 *
 * - Allowed CRM-00 state transitions and stage codes.
 * - Tenant database/role names derived ONLY from the permanent tenant UUID.
 * - Safe PostgreSQL identifier quoting backed by strict generation patterns.
 * - Per-tenant advisory-lock key derivation.
 *
 * Nothing in this file touches secrets, connection strings, or a database.
 */

export type ProvisioningState = 'pending' | 'in_progress' | 'ready' | 'failed';

export const PROVISIONING_STATES: readonly ProvisioningState[] = [
  'pending',
  'in_progress',
  'ready',
  'failed',
];

/**
 * CRM-00 state machine: `pending -> in_progress -> ready | failed`;
 * retry `failed -> in_progress`; reaching `ready` is terminal.
 */
const ALLOWED_TRANSITIONS: Record<
  ProvisioningState,
  readonly ProvisioningState[]
> = {
  pending: ['in_progress'],
  in_progress: ['ready', 'failed'],
  failed: ['in_progress'],
  ready: [],
};

export function isTransitionAllowed(
  from: ProvisioningState,
  to: ProvisioningState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Durable stage codes recorded in `tenant_provisioning.stage`.
 * `claimed` is written when a worker takes per-tenant ownership; the other
 * codes are recorded as each step completes or fails.
 */
export const PROVISIONING_STAGE_CODES = [
  'claimed',
  'database',
  'credential',
  'role',
  'migrations',
  'ready',
] as const;

export type ProvisioningStage = (typeof PROVISIONING_STAGE_CODES)[number];

/**
 * Stable sanitized failure codes. Raw exception text, stack traces, SQL,
 * credentials, and connection strings are never mapped into these values,
 * so a failure remains diagnosable without leaking anything sensitive.
 */
export const PROVISIONING_FAILURE_CODES = [
  'control_plane_update_failed',
  'database_create_failed',
  'credential_store_failed',
  'role_create_failed',
  'migration_failed',
  'ready_update_failed',
  'database_name_mismatch',
] as const;

export type ProvisioningFailureCode =
  (typeof PROVISIONING_FAILURE_CODES)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTenantUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Tenant identifiers are permanent PostgreSQL UUIDs; database names come
 * only from that UUID, never from display names and never from requests.
 */
export function tenantDatabaseName(tenantId: string): string {
  if (!isValidTenantUuid(tenantId)) {
    throw new Error('Tenant UUID is required to derive a database name.');
  }
  return `sdb_${tenantId.toLowerCase().replaceAll('-', '')}`;
}

/** Least-privilege application role name, also derived from the tenant UUID. */
export function tenantDatabaseRoleName(tenantId: string): string {
  if (!isValidTenantUuid(tenantId)) {
    throw new Error('Tenant UUID is required to derive a role name.');
  }
  return `tapp_${tenantId.toLowerCase().replaceAll('-', '')}`;
}

/**
 * Quotes a PostgreSQL identifier after insisting it matches the strict
 * pattern used by every generated name. External values never reach SQL as
 * unvalidated identifiers.
 */
export function quotePgIdentifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error('Unsafe PostgreSQL identifier rejected.');
  }
  return `"${name}"`;
}

/** Quotes a string literal for trust-internal DDL (defense in depth). */
export function quotePgLiteral(value: string): string {
  return `'${value.replaceAll(`'`, `''`)}'`;
}

const PASSWORD_BYTES = 24;

/**
 * Tenant role credential generated in memory only. Callers hold it just
 * long enough to create the role and hand it to the configured secret
 * store; it is never logged, stored in the Control Plane, or returned.
 */
export function generateTenantRolePassword(): string {
  return randomBytes(PASSWORD_BYTES).toString('base64url');
}

/**
 * Deterministic signed 64-bit advisory-lock key per tenant. PostgreSQL's
 * bigint advisory locks are signed, so the digest is reinterpreted as int64
 * instead of an unsigned magnitude. Hashing (instead of reusing raw UUID
 * bytes) keeps the lock space independent of identifiers.
 */
export function tenantAdvisoryLockKey(tenantId: string): bigint {
  if (!isValidTenantUuid(tenantId)) {
    throw new Error('Tenant UUID is required to derive a lock key.');
  }
  const digest = createHash('sha256')
    .update(`tenant-provisioning-lock:${tenantId.toLowerCase()}`)
    .digest();
  return BigInt.asIntN(64, digest.readBigUInt64BE(0));
}
