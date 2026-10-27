import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type { CustomerScope, TenantContext } from './identity.contracts';

export interface TenantMemberRecord {
  actorId: string;
  role: 'tenant_member';
  customerScope: CustomerScope;
  status: 'active' | 'revoked';
}

export type TenantMemberListItem = TenantMemberRecord;

@Injectable()
export class TenantMembershipService {
  constructor(private readonly controlPlane: Pool) {}

  async listMembers(context: TenantContext): Promise<TenantMemberListItem[]> {
    this.assertTenantAdmin(context);
    const result = await this.controlPlane.query<{
      actor_id: string;
      customer_scope: CustomerScope;
      status: 'active' | 'revoked';
    }>(
      `SELECT actor_id, customer_scope, status
         FROM tenant_memberships
        WHERE tenant_id = $1 AND role = 'tenant_member'
        ORDER BY actor_id`,
      [context.tenantId],
    );
    return result.rows.map((row) => ({
      actorId: row.actor_id,
      role: 'tenant_member',
      customerScope: row.customer_scope,
      status: row.status,
    }));
  }

  async grantMember(
    context: TenantContext,
    actorId: string,
    scope: CustomerScope,
  ): Promise<TenantMemberRecord> {
    this.assertTenantAdmin(context);
    assertScope(scope);
    return this.mutate(
      context,
      actorId,
      'tenant.membership.grant',
      async (client) => {
        const result = await client.query<{
          actor_id: string;
          customer_scope: CustomerScope;
          status: 'active';
        }>(
          `INSERT INTO tenant_memberships (tenant_id, actor_id, role, customer_scope, status)
         SELECT $1, a.id, 'tenant_member', $3, 'active' FROM identity_actors a WHERE a.id = $2
         RETURNING actor_id, customer_scope, status`,
          [context.tenantId, actorId, scope],
        );
        if (!result.rowCount)
          throw new NotFoundException('Member identity not found');
        return {
          actorId: result.rows[0].actor_id,
          role: 'tenant_member',
          customerScope: result.rows[0].customer_scope,
          status: result.rows[0].status,
        };
      },
    );
  }

  async updateMemberScope(
    context: TenantContext,
    actorId: string,
    scope: CustomerScope,
  ): Promise<TenantMemberRecord> {
    this.assertTenantAdmin(context);
    assertScope(scope);
    return this.mutate(
      context,
      actorId,
      'tenant.membership.scope.update',
      async (client) => {
        const result = await client.query<{
          actor_id: string;
          customer_scope: CustomerScope;
          status: 'active';
        }>(
          `UPDATE tenant_memberships SET customer_scope = $3, updated_at = now()
         WHERE tenant_id = $1 AND actor_id = $2 AND role = 'tenant_member' AND status = 'active'
         RETURNING actor_id, customer_scope, status`,
          [context.tenantId, actorId, scope],
        );
        if (!result.rowCount)
          throw new NotFoundException('Active tenant member not found');
        return {
          actorId: result.rows[0].actor_id,
          role: 'tenant_member',
          customerScope: result.rows[0].customer_scope,
          status: result.rows[0].status,
        };
      },
    );
  }

  async revokeMember(context: TenantContext, actorId: string): Promise<void> {
    this.assertTenantAdmin(context);
    await this.mutate(
      context,
      actorId,
      'tenant.membership.revoke',
      async (client) => {
        const result = await client.query(
          `UPDATE tenant_memberships SET status = 'revoked', updated_at = now()
         WHERE tenant_id = $1 AND actor_id = $2 AND role = 'tenant_member' AND status = 'active'
         RETURNING actor_id`,
          [context.tenantId, actorId],
        );
        if (!result.rowCount)
          throw new NotFoundException('Active tenant member not found');
      },
    );
  }

  private assertTenantAdmin(context: TenantContext): void {
    if (context.role !== 'tenant_admin') throw new ForbiddenException();
  }

  private async mutate<T>(
    context: TenantContext,
    actorId: string,
    action: string,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.controlPlane.connect();
    try {
      await client.query('BEGIN');
      const member = await operation(client);
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_id, action, resource_type, resource_id, result)
         VALUES ($1, $2, $3, 'membership', $4, 'success')`,
        [context.tenantId, context.actorId, action, actorId],
      );
      await client.query('COMMIT');
      return member;
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as NodeJS.ErrnoException).code === '23505'
      ) {
        throw new ConflictException('Tenant membership already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function assertScope(scope: CustomerScope): void {
  if (scope !== 'cpf' && scope !== 'pj' && scope !== 'both')
    throw new ForbiddenException('Invalid customer scope');
}
