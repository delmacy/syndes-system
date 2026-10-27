import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { allowsCustomerScope } from '../platform-core/identity/tenant-permissions';

/**
 * CRM-05 customer_scope application (CRM-00 contract), resolved server-side.
 *
 * - `cpf` sees Persons with no PJ Organization link; Organization and
 *   Relationship surfaces are not part of a `cpf` attendant's customer base.
 * - `pj` sees Organizations plus their linked contact Persons; an unlinked
 *   Person is not in a `pj` attendant's customer base.
 * - `both` sees both worlds. `tenant_admin` memberships always carry
 *   `both` (Control Plane constraint), so admins are never scope-limited.
 *
 * Persons visibility filter, applied to every person list/detail/update
 * path. Undefined means "no extra filtering".
 */
export function personScopeCondition(context: TenantContext): SQL | undefined {
  if (context.customerScope === 'both') return undefined;
  const linked = sql`EXISTS (
    SELECT 1 FROM "crm_relationships"
    WHERE "crm_relationships"."person_id" = "crm_people"."id"
  )`;
  return context.customerScope === 'cpf' ? sql`NOT ${linked}` : linked;
}

/** Organization/Relationship surfaces require `pj` visibility. */
export function organizationsInScope(context: TenantContext): boolean {
  return allowsCustomerScope(context, 'pj');
}
