import { Module } from '@nestjs/common';
import type { Pool } from 'pg';
import { AuditService } from '../identity/audit.service';
import { readIdentityConfig } from '../identity/identity-config';
import { TenantProvisioningService } from '../control-plane/provisioning/tenant-provisioning.service';
import {
  CONTROL_PLANE_DATABASE,
  PlatformCoreModule,
} from '../platform-core.module';
import { MANAGER_PROBLEM_DETAILS_FILTER } from './manager-problem-details';
import { ManagerTenantsController } from './manager-tenants.controller';
import { ManagerTenantsService } from './manager-tenants.service';

export const MANAGER_CONFIGURED_KEYCLOAK_ISSUER =
  'MANAGER_CONFIGURED_KEYCLOAK_ISSUER';

/**
 * CRM-04 Platform Admin manager API boundary.
 *
 * Only tenant metadata/provisioning/membership-assignment surfaces; it never
 * imports CRM modules, never touches tenant databases, and never exposes
 * secrets or CRM records. The RFC 9457 Problem Details filter is registered
 * once here for the whole API, matching the CRM-00 error contract.
 */
@Module({
  imports: [PlatformCoreModule],
  controllers: [ManagerTenantsController],
  providers: [
    MANAGER_PROBLEM_DETAILS_FILTER,
    {
      provide: MANAGER_CONFIGURED_KEYCLOAK_ISSUER,
      useFactory: () => readIdentityConfig().issuer,
    },
    {
      provide: ManagerTenantsService,
      useFactory: (
        controlPlane: Pool,
        provisioning: TenantProvisioningService,
        audit: AuditService,
        configuredIssuer: string,
      ): ManagerTenantsService =>
        new ManagerTenantsService(
          controlPlane,
          provisioning,
          audit,
          configuredIssuer,
        ),
      inject: [
        CONTROL_PLANE_DATABASE,
        TenantProvisioningService,
        AuditService,
        MANAGER_CONFIGURED_KEYCLOAK_ISSUER,
      ],
    },
  ],
})
export class ManagerModule {}
