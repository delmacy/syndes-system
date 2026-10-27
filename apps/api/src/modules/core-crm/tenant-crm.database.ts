import { Injectable } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { TenantDatabasePoolRegistry } from '../platform-core/identity/tenant-database-pool.registry';

export type TenantCrmDb = NodePgDatabase<Record<string, never>>;

/**
 * Server-side tenant database access for Core CRM.
 *
 * Every CRM statement runs through the TenantContext-resolved tenant
 * database pool registry; no request value ever selects a connection
 * target, and another tenant database is never addressable from here.
 */
@Injectable()
export class TenantCrmDatabase {
  constructor(private readonly tenantPools: TenantDatabasePoolRegistry) {}

  async withTenant<T>(
    context: TenantContext,
    work: (db: TenantCrmDb) => Promise<T>,
  ): Promise<T> {
    return this.tenantPools.withClient(context, (client) =>
      work(drizzle(client)),
    );
  }
}
