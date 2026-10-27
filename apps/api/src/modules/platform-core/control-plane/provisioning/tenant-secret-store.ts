/**
 * Narrow CRM-02 secret/config contract for tenant database credentials.
 *
 * The provisioning service only knows this port. Credentials are generated
 * in memory, handed to this store exactly once, and never written to the
 * Control Plane, business records, logs, or API responses.
 *
 * Deployment binding status (approved PRD-001 handoff): the concrete secret
 * store is environment-dependent and remains an UNRESOLVED decision until a
 * deployment provider is approved. `UnresolvedTenantSecretStore` makes that
 * choice explicit by failing any provisioning attempt that has not been
 * wired to a deployment-approved implementation. No cloud provider is
 * implemented and no credentials are invented in this slice.
 */

import { Injectable } from '@nestjs/common';

export interface TenantDatabaseCredential {
  /** Non-secret database reference (already derived from the tenant UUID). */
  databaseName: string;
  /** Least-privilege tenant role name (non-secret). */
  username: string;
  /** Role password; must never be echoed, logged, or persisted elsewhere. */
  password: string;
}

export interface TenantSecretStore {
  /**
   * Persists the tenant database credential in the deployment's approved
   * secret store. Called once per credential generation, before the role is
   * created, so a role never exists without a stored credential.
   */
  saveTenantDatabaseCredential(
    tenantId: string,
    credential: TenantDatabaseCredential,
  ): Promise<void>;
  /** Reads only from the deployment-approved secret store; never CP storage. */
  getTenantDatabaseCredential?(
    tenantId: string,
  ): Promise<TenantDatabaseCredential>;
}

export class TenantSecretStoreConfigurationError extends Error {
  constructor() {
    super(
      'No deployment-approved tenant credential secret store is bound; configure one before provisioning tenant databases.',
    );
    this.name = 'TenantSecretStoreConfigurationError';
  }
}

/**
 * Explicit default binding used until a deployment provider is approved.
 * Fails closed without touching any external system or inventing values.
 */
@Injectable()
export class UnresolvedTenantSecretStore implements TenantSecretStore {
  saveTenantDatabaseCredential(): Promise<void> {
    return Promise.reject(new TenantSecretStoreConfigurationError());
  }

  getTenantDatabaseCredential(): Promise<TenantDatabaseCredential> {
    return Promise.reject(new TenantSecretStoreConfigurationError());
  }
}
