import { Module } from '@nestjs/common';
import {
  createControlPlanePool,
  createTenantAdminPool,
  resolveTenantAdminDatabaseUrl,
} from './control-plane/provisioning/control-plane-database.provider';
import { TenantProvisioningService } from './control-plane/provisioning/tenant-provisioning.service';
import {
  TenantSecretStore,
  UnresolvedTenantSecretStore,
} from './control-plane/provisioning/tenant-secret-store';
import type { Pool } from 'pg';

export const CONTROL_PLANE_DATABASE = 'CONTROL_PLANE_DATABASE';
export const TENANT_ADMIN_DATABASE = 'TENANT_ADMIN_DATABASE';
export const TENANT_SECRET_STORE = 'TENANT_SECRET_STORE';

/**
 * Platform Core feature boundary (PRD-001 Stage 1).
 *
 * Control Plane tenant registry persistence lives in ./control-plane:
 * - `control-plane/tenant-registry.schema.ts` defines the Drizzle schema for
 *   the Control Plane database's tenant registry.
 * - `control-plane/provisioning/` implements CRM-02: the idempotent tenant
 *   provisioning service, the narrow secret-store port, and the tenant
 *   migration runner. Tenant migrations never run during API startup; they
 *   run only when a tenant's provisioning is claimed (or via the separate
 *   `tenant:migrations:apply` release script).
 * - Reviewed Control Plane SQL migrations and their Drizzle journal live in
 *   `drizzle/control-plane/`; tenant baseline migrations live in
 *   `drizzle/tenant/`. Both are applied as separate release/CI steps using
 *   the configured database URLs.
 *
 * The tenant credential secret store is an explicit deployment binding:
 * before a deployment provider is approved, the module wires
 * `UnresolvedTenantSecretStore`, which fails closed so no tenant can be
 * provisioned without a deployment-approved store.
 */
@Module({
  providers: [
    {
      provide: CONTROL_PLANE_DATABASE,
      useFactory: () => createControlPlanePool(),
    },
    {
      provide: TENANT_ADMIN_DATABASE,
      useFactory: (): Pool => createTenantAdminPool(),
    },
    {
      provide: TENANT_SECRET_STORE,
      useClass: UnresolvedTenantSecretStore,
    },
    {
      provide: TenantProvisioningService,
      useFactory: (
        pool: Pool,
        adminPool: Pool,
        secretStore: TenantSecretStore,
      ): TenantProvisioningService =>
        new TenantProvisioningService(pool, secretStore, {
          adminPool,
          adminConnectionString: resolveTenantAdminDatabaseUrl(),
        }),
      inject: [
        CONTROL_PLANE_DATABASE,
        TENANT_ADMIN_DATABASE,
        TENANT_SECRET_STORE,
      ],
    },
  ],
  exports: [TenantProvisioningService],
})
export class PlatformCoreModule {}
