import { Module } from '@nestjs/common';

/**
 * Platform Core feature boundary (PRD-001 Stage 1).
 * Shell only — no providers, controllers, or runtime persistence yet.
 *
 * Control Plane tenant registry persistence lives in ./control-plane:
 * - `control-plane/tenant-registry.schema.ts` defines the Drizzle schema for
 *   the Control Plane database's tenant registry.
 * - Reviewed Control Plane SQL migrations and their Drizzle journal live in
 *   `drizzle/control-plane/` and are applied by the separate
 *   `cp:migrations:apply` release command using `CONTROL_PLANE_DATABASE_URL`.
 *
 * This module must never open tenant database connections.
 */
@Module({})
export class PlatformCoreModule {}
