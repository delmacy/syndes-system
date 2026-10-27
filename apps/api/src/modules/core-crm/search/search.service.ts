import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import {
  normalizeDigits,
  normalizeSearchText,
} from '../normalization/normalize';
import type { SearchQuery } from './search-dtos';
import { TenantCrmDatabase } from '../tenant-crm.database';
import {
  crmOrganizations,
  crmPeople,
  crmRelationships,
} from '../tenant-crm.schema';
import { crmTagAssignments, crmTags } from '../tags/tags.schema';

export interface CrmSearchItem {
  entityType: 'person' | 'organization';
  id: string;
  name: string;
  organizationName?: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  tags: string[];
  matchedFields: string[];
}

export interface CrmSearchResult {
  items: CrmSearchItem[];
  page: number;
  pageSize: number;
  total: number;
}

/** Tenant-database search. Scope predicates are part of SQL reads, before
 * records, matches, and totals are calculated. */
@Injectable()
export class CrmSearchService {
  constructor(private readonly tenantDb: TenantCrmDatabase) {}

  async search(
    context: TenantContext,
    query: SearchQuery,
  ): Promise<CrmSearchResult> {
    const needle = normalizeSearchText(query.query);
    return this.tenantDb.withTenant(context, async (db) => {
      const people = await db
        .select()
        .from(crmPeople)
        .where(and(isNull(crmPeople.archivedAt), personScopeCondition(context)))
        .orderBy(asc(crmPeople.id));
      const organizations = organizationsInScope(context)
        ? await db
            .select()
            .from(crmOrganizations)
            .where(isNull(crmOrganizations.archivedAt))
            .orderBy(asc(crmOrganizations.id))
        : [];

      const personIds = new Set(people.map((row) => row.id));
      const organizationIds = new Set(organizations.map((row) => row.id));
      const relationships =
        personIds.size && organizationIds.size
          ? await db
              .select()
              .from(crmRelationships)
              .where(
                and(
                  inArray(crmRelationships.personId, [...personIds]),
                  inArray(crmRelationships.organizationId, [
                    ...organizationIds,
                  ]),
                ),
              )
          : [];
      const visibleRelationships = relationships.filter(
        (row) =>
          personIds.has(row.personId) &&
          organizationIds.has(row.organizationId),
      );
      const organizationById = new Map(
        organizations.map((row) => [row.id, row]),
      );
      const organizationByPerson = new Map<string, string>();
      for (const row of visibleRelationships) {
        organizationByPerson.set(row.personId, row.organizationId);
      }

      const tagFilters = [
        ...(personIds.size
          ? [inArray(crmTagAssignments.personId, [...personIds])]
          : []),
        ...(organizationIds.size
          ? [inArray(crmTagAssignments.organizationId, [...organizationIds])]
          : []),
      ];
      const tagRows = tagFilters.length
        ? await db
            .select({
              personId: crmTagAssignments.personId,
              organizationId: crmTagAssignments.organizationId,
              name: crmTags.name,
            })
            .from(crmTagAssignments)
            .innerJoin(crmTags, eq(crmTags.id, crmTagAssignments.tagId))
            .where(or(...tagFilters))
        : [];
      const tagsByEntity = new Map<string, string[]>();
      for (const row of tagRows) {
        const entityId = row.personId ?? row.organizationId;
        if (
          !entityId ||
          (!personIds.has(entityId) && !organizationIds.has(entityId))
        )
          continue;
        const tags = tagsByEntity.get(entityId) ?? [];
        tags.push(row.name);
        tagsByEntity.set(entityId, tags);
      }

      const results: CrmSearchItem[] = [];
      for (const row of people) {
        const organizationId = organizationByPerson.get(row.id);
        const organization = organizationId
          ? organizationById.get(organizationId)
          : undefined;
        const tags = tagsByEntity.get(row.id) ?? [];
        const matchedFields = matches(needle, {
          name: row.fullName,
          company: organization?.name,
          phone: row.phone,
          email: row.email,
          document: row.cpf,
          tags,
        });
        if (matchedFields.length) {
          results.push({
            entityType: 'person',
            id: row.id,
            name: row.fullName,
            ...(organization ? { organizationName: organization.name } : {}),
            email: row.email ?? null,
            phone: row.phone ?? null,
            document: row.cpf ?? null,
            tags,
            matchedFields,
          });
        }
      }
      for (const row of organizations) {
        const tags = tagsByEntity.get(row.id) ?? [];
        const matchedFields = matches(needle, {
          name: row.name,
          phone: row.phone,
          email: row.email,
          document: row.cnpj,
          tags,
        });
        if (matchedFields.length) {
          results.push({
            entityType: 'organization',
            id: row.id,
            name: row.name,
            email: row.email ?? null,
            phone: row.phone ?? null,
            document: row.cnpj ?? null,
            tags,
            matchedFields,
          });
        }
      }
      results.sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id),
      );
      const offset = (query.page - 1) * query.pageSize;
      return {
        items: results.slice(offset, offset + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total: results.length,
      };
    });
  }
}

function matches(
  needle: string,
  fields: {
    name: string;
    company?: string;
    phone?: string | null;
    email?: string | null;
    document?: string | null;
    tags: string[];
  },
): string[] {
  const found: string[] = [];
  if (contains(fields.name, needle)) found.push('name');
  if (fields.company && contains(fields.company, needle)) found.push('company');
  if (fields.phone && contains(fields.phone, needle, true)) found.push('phone');
  if (fields.email && contains(fields.email, needle)) found.push('email');
  if (fields.document && contains(fields.document, needle, true))
    found.push('document');
  if (fields.tags.some((tag) => contains(tag, needle))) found.push('tag');
  return found;
}

function contains(value: string, needle: string, digits = false): boolean {
  return (
    normalizeSearchText(value).includes(needle) ||
    (digits &&
      normalizeDigits(needle).length > 0 &&
      normalizeDigits(value).includes(normalizeDigits(needle)))
  );
}
