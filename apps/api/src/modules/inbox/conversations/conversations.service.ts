import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { notFoundProblem } from '../../core-crm/crm-problem-details';
import { TenantCrmDatabase } from '../../core-crm/tenant-crm.database';
import type { TenantCrmDb } from '../../core-crm/tenant-crm.database';
import { crmOrganizations, crmPeople } from '../../core-crm/tenant-crm.schema';
import type {
  InboxChannel,
  InboxConversationStatus,
  InboxListQuery,
} from '../inbox-dtos';
import { inboxConversations } from '../inbox.schema';
import { conversationScopeCondition } from '../inbox-scope';

export interface InboxConversationResource {
  id: string;
  status: InboxConversationStatus;
  channel: InboxChannel;
  assigneeActorId: string | null;
  personId: string | null;
  organizationId: string | null;
  subject: string | null;
  customerId: string | null;
  preview: string;
  /** There is no read/unread model in the MVP; always zero, never invented. */
  unreadCount: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  person: { id: string; fullName: string } | null;
  organization: { id: string; name: string } | null;
}

export interface InboxConversationListResult {
  items: InboxConversationResource[];
  page: number;
  pageSize: number;
  total: number;
}

const PREVIEW_MAX_LENGTH = 160;

function previewOf(value: string | null | undefined): string {
  if (!value) return '';
  return value.length <= PREVIEW_MAX_LENGTH
    ? value
    : `${value.slice(0, PREVIEW_MAX_LENGTH - 1)}…`;
}

function conversationWhere(
  context: TenantContext,
  query?: Pick<InboxListQuery, 'status' | 'channel' | 'assignee'>,
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    conversationScopeCondition(context),
    query?.status ? eq(inboxConversations.status, query.status) : undefined,
    query?.channel ? eq(inboxConversations.channel, query.channel) : undefined,
    query?.assignee
      ? eq(inboxConversations.assigneeActorId, query.assignee)
      : undefined,
  ];
  const filtered = conditions.filter((item): item is SQL => item !== undefined);
  return filtered.length ? and(...filtered) : undefined;
}

type ConversationJoinRow = {
  conversation: typeof inboxConversations.$inferSelect;
  personName: string | null;
  organizationName: string | null;
  preview: string | null;
};

export function toConversationResource(
  row: ConversationJoinRow,
): InboxConversationResource {
  const { conversation, personName, organizationName } = row;
  return {
    id: conversation.id,
    status: conversation.status as InboxConversationStatus,
    channel: conversation.channel as InboxChannel,
    assigneeActorId: conversation.assigneeActorId ?? null,
    personId: conversation.personId ?? null,
    organizationId: conversation.organizationId ?? null,
    subject: personName ?? organizationName ?? null,
    customerId: conversation.personId ?? conversation.organizationId ?? null,
    preview: previewOf(row.preview),
    unreadCount: 0,
    lastActivity: conversation.updatedAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    person: conversation.personId
      ? { id: conversation.personId, fullName: personName ?? '' }
      : null,
    organization: conversation.organizationId
      ? { id: conversation.organizationId, name: organizationName ?? '' }
      : null,
  };
}

/**
 * INBOX-02 conversation queue and detail.
 *
 * Every query runs through the server-resolved tenant database and applies
 * `conversationScopeCondition` in SQL before pagination/filtering, so a
 * member can never infer another scope's conversations through counts,
 * filters or page sizes. An invisible/foreign id is the same not found.
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly tenantDb: TenantCrmDatabase) {}

  async list(
    context: TenantContext,
    query: InboxListQuery,
  ): Promise<InboxConversationListResult> {
    return this.tenantDb.withTenant(context, async (db) => {
      const where = conversationWhere(context, query);
      const rows = await db
        .select({
          conversation: inboxConversations,
          personName: crmPeople.fullName,
          organizationName: crmOrganizations.name,
          preview: sql<string | null>`(
            SELECT message.body
              FROM "inbox_messages" message
             WHERE message."conversation_id" = ${inboxConversations.id}
             ORDER BY message."created_at" DESC, message."id" DESC
             LIMIT 1
          )`,
        })
        .from(inboxConversations)
        .leftJoin(crmPeople, eq(crmPeople.id, inboxConversations.personId))
        .leftJoin(
          crmOrganizations,
          eq(crmOrganizations.id, inboxConversations.organizationId),
        )
        .where(where)
        .orderBy(desc(inboxConversations.updatedAt), asc(inboxConversations.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      const counted = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(inboxConversations)
        .where(where);

      return {
        items: rows.map(toConversationResource),
        page: query.page,
        pageSize: query.pageSize,
        total: counted[0]?.total ?? 0,
      };
    });
  }

  async get(
    context: TenantContext,
    conversationId: string,
  ): Promise<InboxConversationResource> {
    return this.loadVisibleConversation(context, conversationId);
  }

  /** Minimal visible-conversation loader shared by attachments and realtime. */
  async loadVisibleConversation(
    context: TenantContext,
    conversationId: string,
  ): Promise<InboxConversationResource> {
    return this.tenantDb.withTenant(context, async (db) =>
      loadVisibleConversation(db, context, conversationId),
    );
  }
}

/**
 * Loads one conversation only when it is visible to the acting context.
 *
 * The record id is ALWAYS combined with the scope predicate. Returning the
 * full row (rather than just the id) lets message/note/attachment code reuse
 * the persisted channel and CRM link without a second, separately authorized
 * read.
 */
export async function loadVisibleConversation(
  db: TenantCrmDb,
  context: TenantContext,
  conversationId: string,
): Promise<InboxConversationResource> {
  const rows = await db
    .select({
      conversation: inboxConversations,
      personName: crmPeople.fullName,
      organizationName: crmOrganizations.name,
      preview: sql<string | null>`(
        SELECT message.body
          FROM "inbox_messages" message
         WHERE message."conversation_id" = ${inboxConversations.id}
         ORDER BY message."created_at" DESC, message."id" DESC
         LIMIT 1
      )`,
    })
    .from(inboxConversations)
    .leftJoin(crmPeople, eq(crmPeople.id, inboxConversations.personId))
    .leftJoin(
      crmOrganizations,
      eq(crmOrganizations.id, inboxConversations.organizationId),
    )
    .where(
      and(
        eq(inboxConversations.id, conversationId),
        conversationScopeCondition(context),
      ),
    )
    .limit(1);

  if (!rows.length) {
    throw notFoundProblem('inbox_conversation_not_found');
  }
  return toConversationResource(rows[0]);
}
