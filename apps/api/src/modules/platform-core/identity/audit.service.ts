import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

export interface AuditEventInput {
  tenantId?: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: 'success' | 'denied' | 'failure';
}

/** Deliberately accepts a small allowlisted record; never pass request bodies or tokens. */
@Injectable()
export class AuditService {
  constructor(private readonly controlPlane: Pool) {}

  async record(event: AuditEventInput): Promise<void> {
    if (
      !/^[a-z][a-z0-9_.-]{1,99}$/.test(event.action) ||
      !/^[a-z][a-z0-9_.-]{1,49}$/.test(event.resourceType)
    ) {
      throw new Error('Invalid audit event classification');
    }
    await this.controlPlane.query(
      `INSERT INTO audit_events (tenant_id, actor_id, action, resource_type, resource_id, result)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.tenantId ?? null,
        event.actorId ?? null,
        event.action,
        event.resourceType,
        event.resourceId ?? null,
        event.result,
      ],
    );
  }
}
