import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { tenantDatabaseName } from '../control-plane/provisioning/provisioning-contracts';
import {
  TenantProvisioningError,
  TenantProvisioningNotFoundError,
  TenantDatabaseNameMismatchError,
  TenantProvisioningService,
} from '../control-plane/provisioning/tenant-provisioning.service';
import type { AuditService } from '../identity/audit.service';
import type {
  AssignInitialAdminDto,
  CreateTenantDto,
  ListTenantsQuery,
  UpdateTenantDto,
} from './manager-dtos';
import { ManagerProblemException } from './manager-problem-details';

export interface TenantResource {
  id: string;
  displayName: string;
  provisioningState: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantProvisioningView {
  stage: string | null;
  failureCode: string | null;
  attempt: number | null;
}

export interface TenantDetailResource extends TenantResource {
  provisioning: TenantProvisioningView;
}

export type TenantListItem = TenantResource;

export interface TenantListResult {
  items: TenantListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface InitialAdminMembershipResource {
  tenantId: string;
  actorId: string;
  role: 'tenant_admin';
  customerScope: 'both';
  status: 'active';
}

interface TenantRow {
  id: string;
  display_name: string;
  provisioning_state: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * CRM-04 Platform Admin tenant management (Control Plane only).
 *
 * - Reads and writes the Control Plane database; never a tenant database,
 *   never CRM records, never secrets or connection strings.
 * - Tenant creation uses a permanent server-generated UUID; the tenant
 *   database name is derived from that UUID (never from request data).
 * - Provisioning start/retry delegates to the CRM-02 idempotent service.
 * - The initial `tenant_admin` membership resolves an EXISTING local actor
 *   by exact configured Keycloak issuer + subject; no invitations, no email
 *   linkage, no Keycloak user creation.
 * - Audits every mutation in the same Control Plane transaction as the
 *   state change, with allowlisted action names only (no secrets/PII).
 */
@Injectable()
export class ManagerTenantsService {
  constructor(
    private readonly controlPlane: Pool,
    private readonly provisioning: TenantProvisioningService,
    private readonly audit: AuditService,
    private readonly configuredIssuer: string,
  ) {}

  async list(query: ListTenantsQuery): Promise<TenantListResult> {
    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.controlPlane.query<TenantRow>(
      `SELECT id, display_name, provisioning_state, created_at, updated_at
         FROM tenants
        ORDER BY created_at DESC, id
        LIMIT $1 OFFSET $2`,
      [query.pageSize, offset],
    );
    const counted = await this.controlPlane.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM tenants`,
    );
    return {
      items: rows.rows.map(toTenantResource),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(counted.rows[0]?.total ?? 0),
    };
  }

  async getDetail(tenantId: string): Promise<TenantDetailResource> {
    const result = await this.controlPlane.query<
      TenantRow & {
        stage: string | null;
        failure_code: string | null;
        attempt: number | null;
      }
    >(
      `SELECT t.id, t.display_name, t.provisioning_state, t.created_at, t.updated_at,
              p.stage, p.failure_code, p.attempt
         FROM tenants t
         LEFT JOIN tenant_provisioning p ON p.tenant_id = t.id
        WHERE t.id = $1`,
      [tenantId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new ManagerProblemException({
        code: 'tenant_not_found',
        statusCode: HttpStatus.NOT_FOUND,
        detail: 'Tenant not found.',
      });
    }
    return {
      ...toTenantResource(row),
      provisioning: {
        stage: row.stage,
        failureCode: row.failure_code,
        attempt: row.attempt,
      },
    };
  }

  async create(
    input: CreateTenantDto,
    actorId: string,
  ): Promise<TenantResource> {
    const tenantId = randomUUID();
    return this.withTransaction(async (client) => {
      const inserted = await client.query<TenantRow>(
        `INSERT INTO tenants (id, display_name, database_name, provisioning_state)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, display_name, provisioning_state, created_at, updated_at`,
        [tenantId, input.displayName, tenantDatabaseName(tenantId)],
      );
      await this.auditWithinTransaction(
        client,
        'tenant.created',
        inserted.rows[0].id,
        actorId,
      );
      return toTenantResource(inserted.rows[0]);
    });
  }

  async updateMetadata(
    tenantId: string,
    input: UpdateTenantDto,
    actorId: string,
  ): Promise<TenantResource> {
    return this.withTransaction(async (client) => {
      const updated = await client.query<TenantRow>(
        `UPDATE tenants SET display_name = $2, updated_at = now()
          WHERE id = $1
          RETURNING id, display_name, provisioning_state, created_at, updated_at`,
        [tenantId, input.displayName],
      );
      if (!updated.rowCount) {
        throw new ManagerProblemException({
          code: 'tenant_not_found',
          statusCode: HttpStatus.NOT_FOUND,
          detail: 'Tenant not found.',
        });
      }
      await this.auditWithinTransaction(
        client,
        'tenant.updated',
        updated.rows[0].id,
        actorId,
      );
      return toTenantResource(updated.rows[0]);
    });
  }

  /**
   * Starts or retries provisioning idempotently through the CRM-02 service.
   * A `ready` tenant is a no-op; `failed` resumes with sanitized reporting.
   */
  async startOrRetryProvisioning(
    tenantId: string,
    actorId: string,
  ): Promise<TenantDetailResource> {
    try {
      await this.provisioning.provision(tenantId);
    } catch (error) {
      await this.audit
        .record({
          tenantId,
          actorId,
          action: 'tenant.provisioning.attempt',
          resourceType: 'tenant',
          resourceId: tenantId,
          result: 'failure',
        })
        .catch(() => undefined);
      throw this.mapProvisioningFailure(error);
    }
    await this.audit
      .record({
        tenantId,
        actorId,
        action: 'tenant.provisioning.attempt',
        resourceType: 'tenant',
        resourceId: tenantId,
        result: 'success',
      })
      .catch(() => undefined);
    return this.getDetail(tenantId);
  }

  private mapProvisioningFailure(error: unknown): ManagerProblemException {
    if (error instanceof TenantProvisioningNotFoundError) {
      return new ManagerProblemException({
        code: 'tenant_not_found',
        statusCode: HttpStatus.NOT_FOUND,
        detail: 'Tenant not found.',
      });
    }
    if (error instanceof TenantDatabaseNameMismatchError) {
      return new ManagerProblemException({
        code: 'database_name_mismatch',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        detail:
          'Registry tenant database reference is inconsistent; provisioning is blocked.',
      });
    }
    if (error instanceof TenantProvisioningError) {
      return new ManagerProblemException({
        code: 'provisioning_failed',
        statusCode: HttpStatus.BAD_GATEWAY,
        detail: 'Tenant provisioning failed at a stage; it can be retried.',
        extra: { stage: error.stage, failureCode: error.failureCode },
      });
    }
    return new ManagerProblemException({
      code: 'provisioning_failed',
      statusCode: HttpStatus.BAD_GATEWAY,
      detail: 'Tenant provisioning failed; it can be retried.',
    });
  }

  /**
   * Assigns the initial `tenant_admin` membership to the EXISTING actor whose
   * local identity matches the exact configured Keycloak issuer and subject.
   */
  async assignInitialAdmin(
    tenantId: string,
    input: AssignInitialAdminDto,
    actorId: string,
  ): Promise<InitialAdminMembershipResource> {
    if (input.issuer !== this.configuredIssuer) {
      throw new ManagerProblemException({
        code: 'validation_failed',
        statusCode: HttpStatus.BAD_REQUEST,
        detail: 'issuer must be the configured Keycloak issuer.',
        errors: [{ field: 'issuer', rule: 'unconfigured_issuer' }],
      });
    }
    return this.withTransaction(async (client) => {
      await this.requireReadyTenant(client, tenantId);
      const actor = await client.query<{ id: string }>(
        `SELECT id FROM identity_actors WHERE issuer = $1 AND subject = $2`,
        [input.issuer, input.subject],
      );
      if (!actor.rowCount) {
        throw new ManagerProblemException({
          code: 'actor_not_found',
          statusCode: HttpStatus.NOT_FOUND,
          detail:
            'No local identity actor exists for the configured issuer and subject.',
        });
      }
      const membership = await client.query<{
        tenant_id: string;
        actor_id: string;
        customer_scope: string;
        status: string;
      }>(
        `INSERT INTO tenant_memberships (tenant_id, actor_id, role, customer_scope, status)
         VALUES ($1, $2, 'tenant_admin', 'both', 'active')
         RETURNING tenant_id, actor_id, customer_scope, status`,
        [tenantId, actor.rows[0].id],
      );
      await this.auditWithinTransaction(
        client,
        'tenant.membership.initial_admin',
        tenantId,
        actorId,
      );
      const row = membership.rows[0];
      return {
        tenantId: row.tenant_id,
        actorId: row.actor_id,
        role: 'tenant_admin',
        customerScope: 'both',
        status: 'active',
      };
    });
  }

  private async requireReadyTenant(
    client: PoolClient,
    tenantId: string,
  ): Promise<void> {
    const tenant = await client.query<{ provisioning_state: string }>(
      `SELECT provisioning_state FROM tenants WHERE id = $1`,
      [tenantId],
    );
    if (!tenant.rowCount) {
      throw new ManagerProblemException({
        code: 'tenant_not_found',
        statusCode: HttpStatus.NOT_FOUND,
        detail: 'Tenant not found.',
      });
    }
    if (tenant.rows[0].provisioning_state !== 'ready') {
      throw new ManagerProblemException({
        code: 'tenant_not_ready',
        statusCode: HttpStatus.CONFLICT,
        detail:
          'Initial tenant administration is assigned after tenant provisioning.',
      });
    }
  }

  private async auditWithinTransaction(
    client: PoolClient,
    action: string,
    tenantId: string,
    actorId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_events (tenant_id, actor_id, action, resource_type, resource_id, result)
       VALUES ($1, $2, $3, 'tenant', $4, 'success')`,
      [tenantId, actorId, action, tenantId],
    );
  }

  private async withTransaction<T>(
    block: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.controlPlane.connect();
    try {
      await client.query('BEGIN');
      const result = await block(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The connection is already unusable; surface the original error.
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as NodeJS.ErrnoException).code === '23505'
      ) {
        throw new ManagerProblemException({
          code: 'membership_exists',
          statusCode: HttpStatus.CONFLICT,
          detail: 'A membership already exists for this identity and tenant.',
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function toTenantResource(row: TenantRow): TenantResource {
  return {
    id: row.id,
    displayName: row.display_name,
    provisioningState: row.provisioning_state,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
