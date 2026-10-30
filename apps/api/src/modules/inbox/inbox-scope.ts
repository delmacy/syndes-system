import { and, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
  TenantContext,
  TenantRole,
  CustomerScope,
} from '../platform-core/identity/identity.contracts';

/**
 * INBOX-02 `customer_scope` visibility predicate (PRD-002 / CRM-05).
 *
 * The conversation is the unit of Inbox authorization, but the scope it
 * belongs to must follow the canonical CRM semantics instead of a generic
 * "has any relationship" check:
 *
 * - `cpf`: conversations of a Person with no PJ Organization link. A
 *   conversation explicitly attached to an Organization is PJ context and is
 *   not visible to a `cpf` member.
 * - `pj`: conversations of an Organization and conversations of contact
 *   Persons linked to an Organization.
 * - `both`: both worlds, but still only conversations that are actually
 *   linked to a CRM Person or Organization.
 * - A conversation with neither `person_id` nor `organization_id` is
 *   unlinked and remains visible only to `tenant_admin` until the authorized
 *   CRM flow associates it (PRD-002).
 *
 * `tenant_admin` memberships always carry `both` in the Control Plane, but
 * the admin branch is explicit because admin is not scope-limited at all.
 * Undefined means "no extra filtering"; callers still constrain the record
 * id explicitly.
 */
export function conversationScopeCondition(
  context: TenantContext,
): SQL | undefined {
  if (context.role === 'tenant_admin') return undefined;

  // Correlated EXISTS against the canonical CRM contact link for this
  // conversation's Person. Organization hierarchy is not inferred from any
  // client input.
  const personLinkedToOrganization = sql`EXISTS (
    SELECT 1
      FROM "crm_relationships" rel
     WHERE rel."person_id" = "inbox_conversations"."person_id"
  )`;

  switch (context.customerScope) {
    case 'cpf':
      return and(
        sql`"inbox_conversations"."person_id" IS NOT NULL`,
        sql`"inbox_conversations"."organization_id" IS NULL`,
        sql`NOT ${personLinkedToOrganization}`,
      );
    case 'pj':
      return sql`(
        "inbox_conversations"."organization_id" IS NOT NULL
        OR ${personLinkedToOrganization}
      )`;
    case 'both':
      return sql`(
        "inbox_conversations"."person_id" IS NOT NULL
        OR "inbox_conversations"."organization_id" IS NOT NULL
      )`;
    default:
      // TenantContext is resolved server-side and typed; fail closed if an
      // unexpected value ever reaches the query layer.
      return sql`1 = 0`;
  }
}

/** Predicate for membership assignment targets by resolved scope. */
export function membershipScopeCondition(
  role: TenantRole,
  customerScope: CustomerScope,
) {
  if (role === 'tenant_admin') return undefined;
  if (customerScope === 'both') return undefined;
  if (customerScope === 'cpf' || customerScope === 'pj') {
    return sql`1 = 1`;
  }
  throw new Error('Invalid resolved customer scope');
}

/** Resolves which actor a session may assign to a conversation. */
export function resolveMemberAssignment(
  context: TenantContext,
  targetActorId: string | null,
): { allowed: boolean; reason?: string } {
  if (context.role === 'tenant_admin') return { allowed: true };
  if (targetActorId === null) return { allowed: true };
  if (targetActorId === context.actorId) return { allowed: true };
  return { allowed: false, reason: 'forbidden' };
}
