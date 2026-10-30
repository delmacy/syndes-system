import type { Pool } from 'pg';
import type { TenantContext } from '../platform-core/identity/identity.contracts';

export interface TenantMembership {
  actorId: string;
  role: 'tenant_admin' | 'tenant_member';
  customerScope: 'cpf' | 'pj' | 'both';
}

/**
 * INBOX-02 Control Plane membership port.
 *
 * Membership is resolved exclusively from the Control Plane through the
 * server-resolved tenant context: the tenant id and actor id come from
 * `TenantContext`, never from any request value. A request can never point
 * this port at another tenant's memberships.
 */
export class InboxMembershipPort {
  constructor(private readonly pool: Pool) {}

  /** Resolves the active membership of an actor in the session's tenant. */
  async findActiveMember(
    context: TenantContext,
    actorId: string,
  ): Promise<TenantMembership | null> {
    const result = await this.pool.query<{
      role: string;
      customer_scope: string;
    }>(
      `SELECT role, customer_scope
       FROM tenant_memberships
       WHERE tenant_id = $1 AND actor_id = $2 AND status = 'active'
       LIMIT 1`,
      [context.tenantId, actorId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      actorId,
      role: row.role as TenantMembership['role'],
      customerScope: row.customer_scope as TenantMembership['customerScope'],
    };
  }

  /** Confirms the acting context is an active member of its tenant. */
  async isActiveMember(context: TenantContext): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM tenant_memberships
       WHERE tenant_id = $1 AND actor_id = $2 AND status = 'active'
       LIMIT 1`,
      [context.tenantId, context.actorId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
