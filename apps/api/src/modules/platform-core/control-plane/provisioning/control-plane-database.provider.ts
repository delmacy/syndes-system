import { Pool } from 'pg';

/**
 * Narrow configuration contract for the Control Plane database connection.
 *
 * - `CONTROL_PLANE_DATABASE_URL` opens the Control Plane pool (tenant
 *   registry and provisioning state).
 * - `TENANT_ADMIN_DATABASE_URL` opens the dedicated pool used to create
 *   tenant databases and roles and to run tenant migrations. It is required
 *   and never falls back to the Control Plane URL. Neither URL is ever
 *   logged or returned.
 */

export const CONTROL_PLANE_DATABASE_URL_ENV = 'CONTROL_PLANE_DATABASE_URL';
export const TENANT_ADMIN_DATABASE_URL_ENV = 'TENANT_ADMIN_DATABASE_URL';

export class ControlPlaneConfigurationError extends Error {
  constructor(envVarName: string) {
    super(
      `${envVarName} is required to open a Control Plane database connection.`,
    );
    this.name = 'ControlPlaneConfigurationError';
  }
}

export class TenantAdminDatabaseConfigurationError extends Error {
  constructor() {
    super(
      `${TENANT_ADMIN_DATABASE_URL_ENV} is required for tenant database provisioning.`,
    );
    this.name = 'TenantAdminDatabaseConfigurationError';
  }
}

export function resolveControlPlaneDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env[CONTROL_PLANE_DATABASE_URL_ENV];
  if (!value) {
    throw new ControlPlaneConfigurationError(CONTROL_PLANE_DATABASE_URL_ENV);
  }
  return value;
}

export function resolveTenantAdminDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dedicated = env[TENANT_ADMIN_DATABASE_URL_ENV];
  if (dedicated) {
    return dedicated;
  }
  throw new TenantAdminDatabaseConfigurationError();
}

export function createControlPlanePool(
  env: NodeJS.ProcessEnv = process.env,
): Pool {
  return new Pool({ connectionString: resolveControlPlaneDatabaseUrl(env) });
}

export function createTenantAdminPool(
  env: NodeJS.ProcessEnv = process.env,
): Pool {
  return new Pool({ connectionString: resolveTenantAdminDatabaseUrl(env) });
}
