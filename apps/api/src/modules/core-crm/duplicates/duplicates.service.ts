import { Injectable } from '@nestjs/common';
import { and, asc, isNull } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import {
  normalizeDigits,
  normalizeEmail,
  normalizePhone,
} from '../normalization/normalize';
import { TenantCrmDatabase } from '../tenant-crm.database';
import { crmOrganizations, crmPeople } from '../tenant-crm.schema';
import type { DuplicateCheckInput } from './duplicate-dtos';

export interface DuplicateCandidate {
  entityType: 'person' | 'organization';
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  matchedOn: Array<'cpf' | 'cnpj' | 'email' | 'phone'>;
}

export interface DuplicateCheckResult {
  possibleDuplicates: DuplicateCandidate[];
  truncated: boolean;
}

const MAX_CANDIDATES = 5;

/** Exact contact identifiers only: names alone are too ambiguous to warn. */
@Injectable()
export class DuplicatesService {
  constructor(private readonly tenantDb: TenantCrmDatabase) {}

  async check(
    context: TenantContext,
    input: DuplicateCheckInput,
  ): Promise<DuplicateCheckResult> {
    return this.tenantDb.withTenant(context, async (db) => {
      const candidates: DuplicateCandidate[] = [];
      if (input.entityType === 'person') {
        const people = await db
          .select()
          .from(crmPeople)
          .where(
            and(isNull(crmPeople.archivedAt), personScopeCondition(context)),
          )
          .orderBy(asc(crmPeople.id));
        for (const row of people) {
          const matchedOn: DuplicateCandidate['matchedOn'] = [];
          if (input.cpf && sameDigits(input.cpf, row.cpf))
            matchedOn.push('cpf');
          if (
            input.email &&
            row.email &&
            normalizeEmail(input.email) === normalizeEmail(row.email)
          )
            matchedOn.push('email');
          if (input.phone && samePhone(input.phone, row.phone))
            matchedOn.push('phone');
          if (matchedOn.length)
            candidates.push({
              entityType: 'person',
              id: row.id,
              name: row.fullName,
              email: row.email ?? null,
              phone: row.phone ?? null,
              document: row.cpf ?? null,
              matchedOn,
            });
        }
      } else if (organizationsInScope(context)) {
        const rows = await db
          .select()
          .from(crmOrganizations)
          .where(isNull(crmOrganizations.archivedAt))
          .orderBy(asc(crmOrganizations.id));
        for (const row of rows) {
          const matchedOn: DuplicateCandidate['matchedOn'] = [];
          if (input.cnpj && sameDigits(input.cnpj, row.cnpj))
            matchedOn.push('cnpj');
          if (
            input.email &&
            row.email &&
            normalizeEmail(input.email) === normalizeEmail(row.email)
          )
            matchedOn.push('email');
          if (input.phone && samePhone(input.phone, row.phone))
            matchedOn.push('phone');
          if (matchedOn.length)
            candidates.push({
              entityType: 'organization',
              id: row.id,
              name: row.name,
              email: row.email ?? null,
              phone: row.phone ?? null,
              document: row.cnpj ?? null,
              matchedOn,
            });
        }
      }
      candidates.sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id),
      );
      return {
        possibleDuplicates: candidates.slice(0, MAX_CANDIDATES),
        truncated: candidates.length > MAX_CANDIDATES,
      };
    });
  }
}

function sameDigits(left: string, right: string | null | undefined): boolean {
  return (
    right !== null &&
    right !== undefined &&
    normalizeDigits(left) === normalizeDigits(right)
  );
}

function samePhone(left: string, right: string | null | undefined): boolean {
  return (
    right !== null &&
    right !== undefined &&
    normalizePhone(left) === normalizePhone(right)
  );
}
