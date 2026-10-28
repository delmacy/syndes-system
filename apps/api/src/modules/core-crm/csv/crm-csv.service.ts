import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  PayloadTooLargeException,
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
import {
  csvScopeRowCode,
  validateCsvRow,
  type CsvEntity,
} from './csv-row-validation';

export type { CsvEntity };

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
    if (typeof source !== 'string' && !Buffer.isBuffer(source)) {
      throw new BadRequestException({ code: 'csv_body_required' });
    }
    let parsed;
    try {
      parsed = parseCsv(source);
    } catch (error) {
      if (error instanceof CsvInputError) {
        if (error.code === 'csv_too_large') {
          throw new PayloadTooLargeException({
            code: error.code,
            message: error.message,
          });
        }
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
      await this.audit.denied(context, `crm.${entity}.csv_import`, entity);
      throw new ForbiddenException({ code: 'customer_scope_denied' });
    }

    const records: CsvRecord[] = parsed.rows.map((values, index) => ({
      row: index + 2,
      values: Object.fromEntries(
        parsed.headers.map((header, i) => [header, values[i]]),
      ),
    }));
    const errors: CsvRowError[] = [];
    const normalized: CsvRecord[] = [];
    let invalid = 0;
    const fail = (row: number, code: string) => {
      invalid += 1;
      if (errors.length < 100) errors.push({ row, code });
    };

    await this.tenantDb.withTenant(context, async (db) => {
      const validOrgIds = new Set<string>();
      const uniqueColumn = entity === 'person' ? 'cpf' : 'cnpj';
      const submittedUnique = records
        .map((record) => (record.values[uniqueColumn] ?? '').trim())
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
              .map((record) =>
                (record.values.organizationId ?? '').trim().toLowerCase(),
              )
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
        const scopeCode = csvScopeRowCode(
          entity,
          context.customerScope,
          record.values,
        );
        if (scopeCode) {
          fail(record.row, scopeCode);
          continue;
        }
        const validation = validateCsvRow(entity, record.values);
        if (validation.code || !validation.values) {
          fail(record.row, validation.code ?? 'invalid_row');
          continue;
        }
        const values = validation.values;
        if (
          entity === 'person' &&
          values.organizationId &&
          !validOrgIds.has(values.organizationId)
        ) {
          fail(record.row, 'organization_not_found');
          continue;
        }
        const uniqueValue = values[uniqueColumn];
        if (
          uniqueValue &&
          (existingUnique.has(uniqueValue) || seenUnique.has(uniqueValue))
        ) {
          fail(record.row, `duplicate_${uniqueColumn}`);
          continue;
        }
        if (uniqueValue) seenUnique.add(uniqueValue);
        normalized.push({ row: record.row, values });
      }
    });

    if (invalid) return { imported: 0, invalid, errors };
    try {
      await this.tenantDb.withTenant(context, async (db) =>
        db.transaction(async (tx: TenantCrmTx) => {
          if (entity === 'person') {
            const organizationIds = [
              ...new Set(
                normalized
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
              const staleLink = normalized.find(
                (record) =>
                  record.values.organizationId &&
                  !activeIds.has(record.values.organizationId),
              );
              if (staleLink) throw new CsvAtomicImportError(staleLink.row);
            }
          }
          for (const [index, { values }] of normalized.entries()) {
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
    return { imported: normalized.length, invalid: 0, errors: [] };
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
