import { HttpStatus } from '@nestjs/common';
import {
  MAX_PAGE_SIZE,
  parseAssignInitialAdminDto,
  parseCreateTenantDto,
  parseListTenantsQuery,
  parseTenantIdParam,
  parseUpdateTenantDto,
} from './manager-dtos';
import { ManagerProblemException } from './manager-problem-details';

function validationOf(run: () => unknown): {
  status: number;
  code: string;
  errors: { field: string; rule: string }[];
} {
  try {
    run();
  } catch (error) {
    if (!(error instanceof ManagerProblemException)) {
      throw error;
    }
    const response = error.getResponse() as {
      statusCode?: number;
      code: string;
      errors?: { field: string; rule: string }[];
    };
    return {
      status: response.statusCode ?? HttpStatus.BAD_REQUEST,
      code: response.code,
      errors: response.errors ?? [],
    };
  }
  throw new Error('Expected the parser to reject the input.');
}

describe('CRM-04 manager DTO validation', () => {
  describe(parseCreateTenantDto.name, () => {
    it('accepts a bounded display name and trims it', () => {
      expect(parseCreateTenantDto({ displayName: '  Tenant A  ' })).toEqual({
        displayName: 'Tenant A',
      });
    });

    it('rejects non-objects, missing names, oversized names, and control characters', () => {
      expect(validationOf(() => parseCreateTenantDto(null))).toMatchObject({
        status: 400,
        code: 'invalid_body',
      });
      expect(validationOf(() => parseCreateTenantDto([1]))).toMatchObject({
        status: 400,
        code: 'invalid_body',
      });
      expect(validationOf(() => parseCreateTenantDto({}))).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [{ field: 'displayName', rule: 'required' }],
      });
      expect(
        validationOf(() =>
          parseCreateTenantDto({ displayName: 'x'.repeat(201) }),
        ),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [{ field: 'displayName', rule: 'invalid_value' }],
      });
      expect(
        validationOf(() => parseCreateTenantDto({ displayName: 'bad\nname' })),
      ).toMatchObject({ status: 400, code: 'validation_failed' });
    });

    it('rejects unknown fields so neither tenant_id nor database_name can pass', () => {
      expect(
        validationOf(() =>
          parseCreateTenantDto({
            displayName: 'Tenant A',
            tenant_id: 'other',
            database_name: 'elsewhere',
          }),
        ),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [
          { field: 'tenant_id', rule: 'unknown_field' },
          { field: 'database_name', rule: 'unknown_field' },
        ],
      });
    });
  });

  describe(parseUpdateTenantDto.name, () => {
    it('accepts approved metadata updates only', () => {
      expect(parseUpdateTenantDto({ displayName: 'Renamed' })).toEqual({
        displayName: 'Renamed',
      });
      expect(
        validationOf(() => parseUpdateTenantDto({ role: 'tenant_admin' })),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [
          { field: 'role', rule: 'unknown_field' },
          { field: 'displayName', rule: 'required' },
        ],
      });
    });
  });

  describe(parseAssignInitialAdminDto.name, () => {
    it('accepts an exact issuer and subject pair', () => {
      expect(
        parseAssignInitialAdminDto({
          issuer: 'https://id.test/realms/syndes',
          subject: 'subject-1',
        }),
      ).toEqual({
        issuer: 'https://id.test/realms/syndes',
        subject: 'subject-1',
      });
    });

    it('rejects email-based or malformed identity keys', () => {
      expect(
        validationOf(() =>
          parseAssignInitialAdminDto({ email: 'someone@corp.test' }),
        ),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [
          { field: 'email', rule: 'unknown_field' },
          { field: 'issuer', rule: 'required' },
          { field: 'subject', rule: 'required' },
        ],
      });
      expect(
        validationOf(() =>
          parseAssignInitialAdminDto({
            issuer: 'https://id.test/realms/syndes',
            subject: 'not allowed spaces;injection',
          }),
        ),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [{ field: 'subject', rule: 'invalid_format' }],
      });
    });
  });

  describe(parseListTenantsQuery.name, () => {
    it('accepts bounded pagination', () => {
      expect(
        parseListTenantsQuery({ page: '2', pageSize: MAX_PAGE_SIZE }),
      ).toEqual({ page: 2, pageSize: MAX_PAGE_SIZE });
    });

    it('rejects unbounded or malformed pagination', () => {
      expect(
        validationOf(() => parseListTenantsQuery({ page: '0', pageSize: 10 })),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [{ field: 'page', rule: 'invalid_value' }],
      });
      expect(
        validationOf(() => parseListTenantsQuery({ page: 1, pageSize: 101 })),
      ).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [{ field: 'pageSize', rule: 'exceeds_limit' }],
      });
    });
  });

  describe(parseTenantIdParam.name, () => {
    it('accepts UUID tenant identifiers and normalizes case', () => {
      expect(parseTenantIdParam('0F2B823F-2EAB-4E8A-93F5-23A0E9DC6F92')).toBe(
        '0f2b823f-2eab-4e8a-93f5-23a0e9dc6f92',
      );
    });

    it('rejects arbitrary identifiers instead of probing the registry', () => {
      expect(validationOf(() => parseTenantIdParam('tenant-a'))).toMatchObject({
        status: 400,
        code: 'validation_failed',
        errors: [{ field: 'tenantId', rule: 'invalid_format' }],
      });
    });
  });
});
