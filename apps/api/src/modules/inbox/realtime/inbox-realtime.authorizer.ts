import { HttpStatus, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import {
  CrmProblemException,
  notFoundProblem,
} from '../../core-crm/crm-problem-details';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import { InboxMembershipPort } from '../inbox-membership.port';
import { conversationScopeCondition } from '../inbox-scope';
import { inboxConversations } from '../inbox.schema';

/** Fixed problem for a session whose tenant membership is no longer active. */
export function tenantMembershipInactiveProblem(): CrmProblemException {
  return new CrmProblemException({
    code: 'tenant_membership_inactive',
    statusCode: HttpStatus.FORBIDDEN,
    detail: 'Tenant membership is not active.',
  });
}

/**
 * INBOX-04 realtime authorization, resolved exclusively from the trusted
 * session context and the tenant database of that context.
 *
 * Membership is checked live on every authorization call: the Control Plane
 * is the membership source of truth, so a revoked membership stops delivery
 * even for an already-open stream (the hub closes it). `customer_scope` is
 * re-read from the same membership row, so a scope change cannot be bypassed
 * by a subscription accepted earlier.
 *
 * Conversation visibility reuses INBOX-02's server-side predicate, which
 * also keeps unlinked conversations tenant_admin-only.
 */
@Injectable()
export class InboxRealtimeAuthorizer {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly membershipPort: InboxMembershipPort,
  ) {}

  /** Live membership re-read; updates role/scope when the membership changed. */
  async resolveMembership(
    context: TenantContext,
  ): Promise<TenantContext | null> {
    const membership = await this.membershipPort.findActiveMember(
      context,
      context.actorId,
    );
    if (!membership) return null;
    return {
      ...context,
      role: membership.role,
      customerScope: membership.customerScope,
    };
  }

  async isConversationVisible(
    context: TenantContext,
    conversationId: string,
  ): Promise<boolean> {
    const scopeCondition = conversationScopeCondition(context);
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select({ id: inboxConversations.id })
        .from(inboxConversations)
        .where(
          scopeCondition
            ? and(eq(inboxConversations.id, conversationId), scopeCondition)
            : eq(inboxConversations.id, conversationId),
        )
        .limit(1);
      return rows.length > 0;
    });
  }

  /**
   * Explicit subscription targets must be visible to the acting session at
   * connection time. A hidden/foreign id is the same 404 as any other Inbox
   * read, so neither existence nor customer scope leaks.
   */
  async assertSubscriptionsVisible(
    context: TenantContext,
    conversationIds: readonly string[],
  ): Promise<TenantContext> {
    const refreshed = await this.resolveMembership(context);
    if (!refreshed) throw tenantMembershipInactiveProblem();
    for (const conversationId of conversationIds) {
      if (!(await this.isConversationVisible(refreshed, conversationId))) {
        throw notFoundProblem('inbox_conversation_not_found');
      }
    }
    return refreshed;
  }
}
