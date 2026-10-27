import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { conflictProblem, notFoundProblem } from '../crm-problem-details';
import { CrmAuditWriter } from '../crm-audit';
import { personScopeCondition } from '../crm-scope';
import type {
  ChannelIdentityInput,
  ChannelIdentityResource,
} from './channel-identity-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { crmPeople } from '../tenant-crm.schema';
import { crmChannelIdentities } from './channel-identities.schema';

type ChannelIdentityRow = typeof crmChannelIdentities.$inferSelect;

const RESOURCE_TYPE = 'channel_identity';

function toResource(row: ChannelIdentityRow): ChannelIdentityResource {
  return {
    id: row.id,
    personId: row.personId,
    channel: row.channel as 'whatsapp',
    externalId: row.externalId,
    externalUsername: row.externalUsername ?? undefined,
    pushName: row.pushName ?? undefined,
    businessName: row.businessName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CRM-06 ChannelIdentity adapter surface: external channel identities are
 * linked to a Person by the authorized upsert. Upserts write only the
 * external metadata columns of this table; the confirmed CRM name in
 * `crm_people.full_name` is never written from external names
 * (CRM-00/AGENTS: external names never silently overwrite CRM data).
 *
 * Customer scope applies to every read/write: the Person must be visible
 * to the attendant (`pj` scope sees only linked contact Persons);
 * invisible ids resolve to 404 and archived people cannot receive
 * identities.
 */
@Injectable()
export class ChannelIdentitiesService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
  ) {}

  async list(
    context: TenantContext,
    personId: string,
  ): Promise<{ items: ChannelIdentityResource[] }> {
    return this.tenantDb.withTenant(context, async (db) => {
      const rows = await db
        .select({ id: crmPeople.id, archivedAt: crmPeople.archivedAt })
        .from(crmPeople)
        .where(and(eq(crmPeople.id, personId), personScopeCondition(context)));
      if (!rows.length) throw notFoundProblem('person_not_found');
      const identities = await db
        .select()
        .from(crmChannelIdentities)
        .where(eq(crmChannelIdentities.personId, personId))
        .orderBy(
          asc(crmChannelIdentities.createdAt),
          asc(crmChannelIdentities.id),
        );
      return { items: identities.map(toResource) };
    });
  }

  /**
   * Idempotent metadata upsert keyed by (channel, externalId) inside the
   * tenant database. An identity already linked to another Person cannot
   * be silently reassigned; no crm_people write ever occurs here.
   */
  async upsert(
    context: TenantContext,
    personId: string,
    input: ChannelIdentityInput,
  ): Promise<ChannelIdentityResource> {
    const resource = await this.tenantDb.withTenant(context, async (db) =>
      db.transaction(async (tx: TenantCrmTx) => {
        const rows = await tx
          .select({ id: crmPeople.id, archivedAt: crmPeople.archivedAt })
          .from(crmPeople)
          .where(
            and(eq(crmPeople.id, personId), personScopeCondition(context)),
          );
        if (!rows.length) throw notFoundProblem('person_not_found');
        if (rows[0].archivedAt) {
          await this.audit.denied(
            context,
            `crm.${RESOURCE_TYPE}.upsert`,
            RESOURCE_TYPE,
          );
          throw conflictProblem(
            'resource_archived',
            'Archived records cannot receive channel identities.',
          );
        }
        const byExternalId = and(
          eq(crmChannelIdentities.channel, input.channel),
          eq(crmChannelIdentities.externalId, input.externalId),
        );
        const existing = await tx
          .select()
          .from(crmChannelIdentities)
          .where(byExternalId);
        if (existing.length && existing[0].personId !== personId) {
          throw conflictProblem(
            'channel_identity_conflict',
            'This external identity is already linked to another person.',
          );
        }
        const metadata = {
          externalUsername: input.externalUsername ?? null,
          pushName: input.pushName ?? null,
          businessName: input.businessName ?? null,
          updatedAt: new Date(),
        };
        let identityRows = existing.length
          ? await tx
              .update(crmChannelIdentities)
              .set(metadata)
              .where(eq(crmChannelIdentities.id, existing[0].id))
              .returning()
          : await tx
              .insert(crmChannelIdentities)
              .values({
                personId,
                channel: input.channel,
                externalId: input.externalId,
                ...metadata,
              })
              .onConflictDoNothing()
              .returning();
        if (!identityRows.length) {
          const raced = await tx
            .select()
            .from(crmChannelIdentities)
            .where(byExternalId);
          if (!raced.length || raced[0].personId !== personId) {
            throw conflictProblem(
              'channel_identity_conflict',
              'This external identity is already linked to another person.',
            );
          }
          identityRows = await tx
            .update(crmChannelIdentities)
            .set(metadata)
            .where(eq(crmChannelIdentities.id, raced[0].id))
            .returning();
        }
        return toResource(identityRows[0]);
      }),
    );
    await this.audit.success(
      context,
      'crm.channel_identity.upserted',
      RESOURCE_TYPE,
      `${input.channel}:${input.externalId}`,
    );
    return resource;
  }
}
