import { Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import type { VerifiedIdentity } from './identity-token-verifier';
import type {
  AuthenticatedActor,
  CustomerScope,
  TenantContext,
  TenantRole,
} from './identity.contracts';

@Injectable()
export class IdentityContextService {
  constructor(private readonly controlPlane: Pool) {}

  async resolveActor(identity: VerifiedIdentity): Promise<AuthenticatedActor> {
    const result = await this.controlPlane.query<{
      id: string;
      platform_admin: boolean;
    }>(
      `SELECT id, platform_admin FROM identity_actors WHERE issuer = $1 AND subject = $2`,
      [identity.issuer, identity.subject],
    );
    if (!result.rowCount)
      throw new NotFoundException('Identity is not provisioned');
    return {
      id: result.rows[0].id,
      issuer: identity.issuer,
      subject: identity.subject,
      platformAdmin: result.rows[0].platform_admin,
    };
  }

  async resolveTenantContext(
    actorId: string,
    validatedHost: string,
  ): Promise<TenantContext> {
    const normalizedHost = validatedHost.toLowerCase().replace(/\.$/, '');
    const result = await this.controlPlane.query<{
      tenant_id: string;
      database_name: string;
      role: TenantRole;
      customer_scope: CustomerScope;
    }>(
      `SELECT t.id AS tenant_id, t.database_name, m.role, m.customer_scope
        FROM tenant_domains d
        JOIN tenants t ON t.id = d.tenant_id AND t.provisioning_state = 'ready'
        JOIN tenant_memberships m ON m.tenant_id = t.id AND m.actor_id = $2 AND m.status = 'active'
        WHERE d.hostname = $1 AND d.status = 'active'`,
      [normalizedHost, actorId],
    );
    if (!result.rowCount) throw new NotFoundException('Tenant not found');
    const row = result.rows[0];
    return {
      actorId,
      tenantId: row.tenant_id,
      databaseName: row.database_name,
      role: row.role,
      customerScope: row.customer_scope,
    };
  }

  async resolvePlatformAdmin(actorId: string): Promise<void> {
    const result = await this.controlPlane.query(
      `SELECT 1 FROM identity_actors WHERE id = $1 AND platform_admin = true`,
      [actorId],
    );
    if (!result.rowCount)
      throw new NotFoundException('Manager identity not found');
  }
}
