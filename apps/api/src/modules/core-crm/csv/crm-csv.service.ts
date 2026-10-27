import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, isNull, inArray } from 'drizzle-orm';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { CrmAuditWriter } from '../crm-audit';
import { organizationsInScope, personScopeCondition } from '../crm-scope';
import { TenantCrmDatabase } from '../tenant-crm.database';
import {
  crmOrganizations,
  crmPeople,
  crmRelationships,
} from '../tenant-crm.schema';
import type { TenantCrmTx } from '../timeline/timeline-recorder';
import { TimelineEventRecorder } from '../timeline/timeline-recorder';
import { CsvInputError, encodeCsv, parseCsv } from './csv-parser';

export type CsvEntity = 'person' | 'organization';

export interface CsvRowError {
  row: number;
  code: string;
}

export interface CsvImportResult {
  imported: number;
  invalid: number;
  errors: CsvRowError[];
}

interface CsvRecord {
  row: number;
  values: Record<string, string>;
}

const PERSON_COLUMNS = ['fullName', 'cpf', 'email', 'phone', 'organizationId'];
const ORGANIZATION_COLUMNS = ['name', 'cnpj', 'email', 'phone'];

class CsvAtomicImportError extends Error {
  constructor(readonly row: number) {
    super('CSV row could not be persisted.');
  }
}

@Injectable()
export class CrmCsvService {
  constructor(
    private readonly tenantDb: TenantCrmDatabase,
    private readonly audit: CrmAuditWriter,
    private readonly timeline: TimelineEventRecorder,
  ) {}

  async importCsv(
    context: TenantContext,
    entity: CsvEntity,
    source: unknown,
  ): Promise<CsvImportResult> {
    if (typeof source !== 'string') {
      throw new BadRequestException({ code: 'csv_body_required' });
    }
    let parsed;
    try {
      parsed = parseCsv(source);
    } catch (error) {
      if (error instanceof CsvInputError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
    const allowed = entity === 'person' ? PERSON_COLUMNS : ORGANIZATION_COLUMNS;
    const required = entity === 'person' ? 'fullName' : 'name';
    const headerProblem =
      parsed.headers.some((name) => !allowed.includes(name)) ||
      !parsed.headers.includes(required);
    if (headerProblem) {
      throw new BadRequestException({ code: 'invalid_header' });
    }
    if (entity === 'organization' && !organizationsInScope(context)) {
      throw new ForbiddenException({ code: 'customer_scope_denied' });
    }

    const records: CsvRecord[] = parsed.rows.map((values, index) => ({
      row: index + 2,
      values: Object.fromEntries(
        parsed.headers.map((header, i) => [header, values[i].trim()]),
      ),
    }));
    const errors: CsvRowError[] = [];
    let invalid = 0;
    const fail = (row: number, code: string) => {
      invalid += 1;
      if (errors.length < 100) errors.push({ row, code });
    };

    await this.tenantDb.withTenant(context, async (db) => {
      const validOrgIds = new Set<string>();
      const uniqueColumn = entity === 'person' ? 'cpf' : 'cnpj';
      const submittedUnique = records
        .map((record) => record.values[uniqueColumn])
        .filter(Boolean);
      const existingUnique = new Set<string>();
      if (submittedUnique.length) {
        if (entity === 'person') {
          const existing = await db
            .select({ value: crmPeople.cpf })
            .from(crmPeople)
            .where(inArray(crmPeople.cpf, submittedUnique));
          existing.forEach(({ value }) => value && existingUnique.add(value));
        } else {
          const existing = await db
            .select({ value: crmOrganizations.cnpj })
            .from(crmOrganizations)
            .where(inArray(crmOrganizations.cnpj, submittedUnique));
          existing.forEach(({ value }) => value && existingUnique.add(value));
        }
      }
      const seenUnique = new Set<string>();
      if (entity === 'person') {
        const organizationIds = [
          ...new Set(
            records
              .map((record) => record.values.organizationId)
              .filter(Boolean),
          ),
        ];
        if (organizationIds.length) {
          const organizations = await db
            .select({ id: crmOrganizations.id })
            .from(crmOrganizations)
            .where(
              and(
                inArray(crmOrganizations.id, organizationIds),
                isNull(crmOrganizations.archivedAt),
              ),
            );
          organizations.forEach(({ id }) => validOrgIds.add(id));
        }
      }
      for (const record of records) {
        const value = record.values;
        let code: string | undefined;
        const uniqueValue = value[uniqueColumn];
        const name = value[required] ?? '';
        if (!name || name.length > 200) code = 'invalid_name';
        else if (
          value.email &&
          (!/^\S+@\S+\.\S+$/.test(value.email) || value.email.length > 320)
        )
          code = 'invalid_email';
        else if (value.phone && value.phone.length > 32) code = 'invalid_phone';
        else if (
          entity === 'person' &&
          value.cpf &&
          (value.cpf.length > 20 || !/^([\d.\-/ ]+)$/.test(value.cpf))
        )
          code = 'invalid_cpf';
        else if (
          entity === 'organization' &&
          value.cnpj &&
          (value.cnpj.length > 20 || !/^([\d.\-/ ]+)$/.test(value.cnpj))
        )
          code = 'invalid_cnpj';
        else if (
          entity === 'person' &&
          context.customerScope === 'pj' &&
          !value.organizationId
        )
          code = 'organization_required_for_scope';
        else if (
          entity === 'person' &&
          context.customerScope === 'cpf' &&
          value.organizationId
        )
          code = 'organization_outside_scope';
        else if (
          entity === 'person' &&
          value.organizationId &&
          !validOrgIds.has(value.organizationId)
        )
          code = 'organization_not_found';
        else if (uniqueValue && existingUnique.has(uniqueValue))
          code = `duplicate_${uniqueColumn}`;
        else if (uniqueValue && seenUnique.has(uniqueValue))
          code = `duplicate_${uniqueColumn}`;
        if (uniqueValue) seenUnique.add(uniqueValue);
        if (code) fail(record.row, code);
      }
    });

    if (invalid) return { imported: 0, invalid, errors };
    try {
      await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          if (entity === 'person') {
            const organizationIds = [
              ...new Set(
                records
                  .map((record) => record.values.organizationId)
                  .filter(Boolean),
              ),
            ];
            if (organizationIds.length) {
              const activeOrganizations = await tx
                .select({ id: crmOrganizations.id })
                .from(crmOrganizations)
                .where(
                  and(
                    inArray(crmOrganizations.id, organizationIds),
                    isNull(crmOrganizations.archivedAt),
                  ),
                );
              const activeIds = new Set(
                activeOrganizations.map((organization) => organization.id),
              );
              const staleLink = records.find(
                (record) =>
                  record.values.organizationId &&
                  !activeIds.has(record.values.organizationId),
              );
              if (staleLink) throw new CsvAtomicImportError(staleLink.row);
            }
          }
          for (const [index, { values }] of records.entries()) {
            try {
              if (entity === 'person') {
                const [person] = await tx
                  .insert(crmPeople)
                  .values({
                    fullName: values.fullName,
                    ...(values.cpf ? { cpf: values.cpf } : {}),
                    ...(values.email ? { email: values.email } : {}),
                    ...(values.phone ? { phone: values.phone } : {}),
                  })
                  .returning();
                await this.timeline.record(tx, {
                  kind: 'person.created',
                  actorId: context.actorId,
                  personId: person.id,
                });
                if (values.organizationId) {
                  await tx.insert(crmRelationships).values({
                    personId: person.id,
                    organizationId: values.organizationId,
                    role: 'contact',
                  });
                  await this.timeline.record(tx, {
                    kind: 'relationship.created',
                    actorId: context.actorId,
                    personId: person.id,
                    organizationId: values.organizationId,
                  });
                }
              } else {
                const [organization] = await tx
                  .insert(crmOrganizations)
                  .values({
                    name: values.name,
                    ...(values.cnpj ? { cnpj: values.cnpj } : {}),
                    ...(values.email ? { email: values.email } : {}),
                    ...(values.phone ? { phone: values.phone } : {}),
                  })
                  .returning();
                await this.timeline.record(tx, {
                  kind: 'organization.created',
                  actorId: context.actorId,
                  organizationId: organization.id,
                });
              }
            } catch {
              throw new CsvAtomicImportError(index + 2);
            }
          }
        }),
      );
    } catch (error) {
      // The transaction guarantees no partial import; never return database text or PII.
      if (error instanceof CsvAtomicImportError) {
        return {
          imported: 0,
          invalid: 1,
          errors: [{ row: error.row, code: 'row_conflict' }],
        };
      }
      return {
        imported: 0,
        invalid: records.length,
        errors: [{ row: 0, code: 'import_conflict' }],
      };
    }
    await this.audit.success(
      context,
      `crm.${entity}.csv_imported`,
      entity,
      null,
    );
    return { imported: records.length, invalid: 0, errors: [] };
  }

  async exportCsv(context: TenantContext, entity: CsvEntity): Promise<string> {
    if (context.role !== 'tenant_admin') {
      await this.audit.denied(context, `crm.${entity}.csv_export`, entity);
      throw new ForbiddenException({ code: 'export_admin_only' });
    }
    const rows = await this.tenantDb.withTenant(context, async (db) => {
      if (entity === 'person') {
        const people = await db
          .select()
          .from(crmPeople)
          .where(
            and(isNull(crmPeople.archivedAt), personScopeCondition(context)),
          );
        return [
          ['fullName', 'cpf', 'email', 'phone'],
          ...people.map((person) => [
            person.fullName,
            person.cpf ?? '',
            person.email ?? '',
            person.phone ?? '',
          ]),
        ];
      }
      if (!organizationsInScope(context))
        return [['name', 'cnpj', 'email', 'phone']];
      const organizations = await db
        .select()
        .from(crmOrganizations)
        .where(isNull(crmOrganizations.archivedAt));
      return [
        ['name', 'cnpj', 'email', 'phone'],
        ...organizations.map((org) => [
          org.name,
          org.cnpj ?? '',
          org.email ?? '',
          org.phone ?? '',
        ]),
      ];
    });
    await this.audit.success(
      context,
      `crm.${entity}.csv_exported`,
      entity,
      null,
    );
    return encodeCsv(rows);
  }
}
