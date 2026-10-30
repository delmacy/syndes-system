import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CanActivate } from '@nestjs/common';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';

jest.mock('../../platform-core/identity/identity-auth.guard', () => ({
  IdentityAuthGuard: class implements CanActivate {
    canActivate(): boolean {
      return true;
    }
  },
}));

jest.mock('../../platform-core/identity/tenant-context.guard', () => ({
  TenantContextGuard: class implements CanActivate {
    canActivate(): boolean {
      return true;
    }
  },
}));

// Resolved to the mocked classes above at runtime; used to assert the
// controller actually registers both guards via @UseGuards.
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { CrmProblemException } from '../crm-problem-details';
import { MembershipsController } from './memberships.controller';

// Lightweight mock - only the methods used by the controller, no database
class MockTenantMembershipService {
  grantMember = jest.fn().mockResolvedValue({
    actorId: '00000000-0000-4000-8000-000000000001',
    role: 'tenant_member' as const,
    customerScope: 'both' as const,
    status: 'active' as const,
  });
  revokeMember = jest.fn().mockResolvedValue(undefined);
  listMembers = jest.fn().mockResolvedValue([]);
  updateMemberScope = jest.fn().mockResolvedValue({
    actorId: '00000000-0000-4000-8000-000000000001',
    role: 'tenant_member' as const,
    customerScope: 'both' as const,
    status: 'active' as const,
  });
}

describe('MembershipsController runtime DTO validation (unit)', () => {
  let controller: MembershipsController;
  let service: MockTenantMembershipService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MockTenantMembershipService();
    // @ts-expect-error: injecting mock service directly
    controller = new MembershipsController(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('grantMember - sync body validation', () => {
    it('rejects non-object body', async () => {
      const request = makeRequest();
      await expect(
        controller.grantMember(request, null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects array body', async () => {
      const request = makeRequest();
      await expect(controller.grantMember(request, [] as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects body with unknown fields', async () => {
      const body = makeBody({
        actorId: '00000000-0000-4000-8000-000000000001',
        customerScope: 'cpf',
        tenantId: 't',
      });
      const request = makeRequest();
      await expect(controller.grantMember(request, body)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects malformed actor UUID in body', async () => {
      const body = makeBody({ actorId: 'not-a-uuid', customerScope: 'cpf' });
      const request = makeRequest();
      await expect(controller.grantMember(request, body)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid customerScope', async () => {
      const body = makeBody({
        actorId: '00000000-0000-4000-8000-000000000001',
        customerScope: 'invalid',
      });
      const request = makeRequest();
      await expect(controller.grantMember(request, body)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts valid body with cpf scope', async () => {
      const body = makeBody({ customerScope: 'cpf' });
      const request = makeRequest();
      await expect(
        controller.grantMember(request, body),
      ).resolves.not.toThrow();
    });

    it('accepts valid body with pj scope', async () => {
      const body = makeBody({ customerScope: 'pj' });
      const request = makeRequest();
      await expect(
        controller.grantMember(request, body),
      ).resolves.not.toThrow();
    });

    it('rejects body without an actorId (absent actor)', async () => {
      const request = makeRequest();
      const body = { customerScope: 'cpf' };
      await expect(controller.grantMember(request, body)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.grantMember).not.toHaveBeenCalled();
    });

    it('rejects body without a customerScope', async () => {
      const body = { actorId: '00000000-0000-4000-8000-000000000001' };
      const request = makeRequest();
      await expect(controller.grantMember(request, body)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.grantMember).not.toHaveBeenCalled();
    });

    it('accepts valid body with both scope', async () => {
      const body = makeBody({ customerScope: 'both' });
      const request = makeRequest();
      await expect(
        controller.grantMember(request, body),
      ).resolves.not.toThrow();
    });
  });

  describe('grantMember - async delegation', () => {
    it('delegates to service.grantMember on valid input', async () => {
      const body = makeBody();
      const request = makeRequest();
      await expect(
        controller.grantMember(request, body),
      ).resolves.not.toThrow();
      expect(service.grantMember).toHaveBeenCalledTimes(1);
    });

    it('delegates to service.grantMember with the validated tenant context values', async () => {
      const body = makeBody({
        actorId: '00000000-0000-4000-8000-000000000009',
        customerScope: 'cpf',
      });
      const request = makeRequest();
      await expect(
        controller.grantMember(request, body),
      ).resolves.not.toThrow();
      expect(service.grantMember).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-a' }),
        '00000000-0000-4000-8000-000000000009',
        'cpf',
      );
    });
  });

  describe('revokeMember - UUID param', () => {
    it('accepts valid UUID actorId param and delegates', async () => {
      const request = makeRequest();
      await expect(
        controller.revokeMember(
          request,
          '00000000-0000-4000-8000-000000000001',
        ),
      ).resolves.not.toThrow();
      expect(service.revokeMember).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed UUID actorId param without calling the service', () => {
      const request = makeRequest();
      // revokeMember is a sync method: parseUuidParam throws before any
      // promise exists, so the assertion must be synchronous.
      expect(() => controller.revokeMember(request, 'not-a-uuid')).toThrow(
        CrmProblemException,
      );
      expect(service.revokeMember).not.toHaveBeenCalled();
    });
  });

  describe('listMembers', () => {
    it('delegates to service.listMembers', async () => {
      const request = makeRequest();
      await expect(controller.list(request)).resolves.not.toThrow();
    });
  });

  describe('updateMemberScope - sync body/param validation', () => {
    it('rejects invalid customerScope in body', async () => {
      const body = { customerScope: 'invalid' };
      const request = makeRequest();
      let error: unknown;
      try {
        await controller.updateScope(
          request,
          '00000000-0000-4000-8000-000000000001',
          body,
        );
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('rejects malformed actor UUID in param', async () => {
      const body = { customerScope: 'cpf' };
      const request = makeRequest();
      let error: unknown;
      try {
        await controller.updateScope(request, 'not-a-uuid', body);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(Error);
    });

    it('rejects scope update bodies with unknown fields', async () => {
      const body = {
        customerScope: 'pj',
        actorId: '00000000-0000-4000-8000-000000000001',
      };
      const request = makeRequest();
      let error: unknown;
      try {
        await controller.updateScope(
          request,
          '00000000-0000-4000-8000-000000000001',
          body,
        );
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      expect(service.updateMemberScope).not.toHaveBeenCalled();
    });

    it('rejects scope update bodies without customerScope', async () => {
      const request = makeRequest();
      let error: unknown;
      try {
        await controller.updateScope(
          request,
          '00000000-0000-4000-8000-000000000001',
          {},
        );
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      expect(service.updateMemberScope).not.toHaveBeenCalled();
    });

    it('accepts valid UUID and scope', async () => {
      const body = { customerScope: 'pj' };
      const request = makeRequest();
      await expect(
        controller.updateScope(
          request,
          '00000000-0000-4000-8000-000000000001',
          body,
        ),
      ).resolves.not.toThrow();
    });

    it('delegates to service.updateMemberScope on valid input', async () => {
      const body = { customerScope: 'cpf' };
      const request = makeRequest();
      await expect(
        controller.updateScope(
          request,
          '00000000-0000-4000-8000-000000000001',
          body,
        ),
      ).resolves.not.toThrow();
      expect(service.updateMemberScope).toHaveBeenCalledTimes(1);
    });
  });

  describe('guard composition (GUARDS_METADATA)', () => {
    it('is decorated with IdentityAuthGuard and TenantContextGuard, in order', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        MembershipsController,
      ) as Array<new (...args: never[]) => unknown> | undefined;
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards?.[0]).toBe(IdentityAuthGuard);
      expect(guards?.[1]).toBe(TenantContextGuard);
    });
  });
});

function makeRequest(
  overrides: {
    tenantId?: string;
    role?: 'tenant_admin' | 'tenant_member';
    actorId?: string;
    customerScope?: string;
  } = {},
): IdentityRequest {
  const defaultTenant = {
    tenantId: overrides.tenantId || 'tenant-a',
    role: overrides.role || ('tenant_admin' as const),
    actorId: overrides.actorId || 'admin-actor',
    customerScope: overrides.customerScope || ('both' as const),
  };

  return {
    identityContext: { tenant: defaultTenant },
    headers: { authorization: 'Bearer mock-token' },
  } as unknown as IdentityRequest;
}

function makeBody(
  overrides: {
    actorId?: string;
    customerScope?: string;
    [key: string]: unknown;
  } = {},
): Record<string, unknown> {
  return {
    actorId:
      overrides.actorId || ('00000000-0000-4000-8000-000000000001' as const),
    customerScope: overrides.customerScope || ('both' as const),
    ...overrides,
  };
}
