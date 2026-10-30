import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CanActivate } from '@nestjs/common';
import type { IdentityRequest } from '../platform-core/identity/identity-auth.guard';

jest.mock('../platform-core/identity/identity-auth.guard', () => ({
  IdentityAuthGuard: class implements CanActivate {
    canActivate(): boolean {
      return true;
    }
  },
}));

jest.mock('../platform-core/identity/tenant-context.guard', () => ({
  TenantContextGuard: class implements CanActivate {
    canActivate(): boolean {
      return true;
    }
  },
}));

// Resolved to the mocked classes above at runtime; used to assert the
// controller actually registers both guards via @UseGuards.
import { IdentityAuthGuard } from '../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../platform-core/identity/tenant-context.guard';
import { forbiddenProblem } from '../core-crm/crm-problem-details';
import { WhatsAppController } from './whatsapp.controller';
import type { TenantContext } from '../platform-core/identity/identity.contracts';

const context: TenantContext = {
  actorId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  databaseName: 'sdb_tenant_a',
  role: 'tenant_admin',
  customerScope: 'both',
};

function makeRequest(
  overrides: {
    role?: 'tenant_admin' | 'tenant_member';
    tenantId?: string;
  } = {},
): IdentityRequest {
  return {
    identityContext: {
      tenant: {
        actorId: '00000000-0000-4000-8000-000000000001',
        tenantId: overrides.tenantId || context.tenantId,
        databaseName: 'sdb_tenant_a',
        role: overrides.role || ('tenant_admin' as const),
        customerScope: 'both',
      },
    },
    headers: { authorization: 'Bearer mock-token' },
  } as unknown as IdentityRequest;
}

class MockConnectionService {
  get = jest.fn().mockResolvedValue(null);
  setState = jest
    .fn()
    .mockResolvedValue({ id: 'conn-1', singletonKey: 'default' });
}
class MockSessionService {
  startPairing = jest.fn().mockResolvedValue({
    pairingCode: 'code-1',
    expiresAt: new Date(),
  });
  connect = jest.fn().mockResolvedValue({
    status: 'connected',
    phoneExternalId: '5511@s.whatsapp.net',
  });
  disconnect = jest.fn().mockResolvedValue({
    status: 'disconnected',
    phoneExternalId: null,
  });
  reconnect = jest.fn().mockResolvedValue({
    status: 'connected',
    phoneExternalId: '5511@s.whatsapp.net',
  });
}
class MockAuditWriter {
  record = jest.fn().mockResolvedValue(undefined);
}

function buildController(
  role: 'tenant_admin' | 'tenant_member' = 'tenant_admin',
) {
  const connections = new MockConnectionService();
  const sessions = new MockSessionService();
  const audit = new MockAuditWriter();
  const controller = new WhatsAppController(connections, sessions, audit);
  return {
    controller,
    connections,
    sessions,
    audit,
    request: makeRequest({ role }),
  };
}

describe('WhatsAppController', () => {
  describe('guard composition (GUARDS_METADATA)', () => {
    it('is decorated with IdentityAuthGuard and TenantContextGuard, in order', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        WhatsAppController,
      ) as Array<new (...args: never[]) => unknown> | undefined;
      expect(guards).toBeDefined();
      expect(guards).toHaveLength(2);
      expect(guards?.[0]).toBe(IdentityAuthGuard);
      expect(guards?.[1]).toBe(TenantContextGuard);
    });
  });

  describe('GET connection', () => {
    it('returns disconnected default when no connection exists', async () => {
      const { controller, connections, request } = buildController();
      const result = await controller.get(request);
      expect(result).toMatchObject({
        provider: 'whatsmeow',
        status: 'disconnected',
        configured: false,
        authorized: false,
        serviceEnabled: true,
        suspensionReason: null,
      });
      expect(connections.get).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
      );
    });

    it('returns the persisted connection when it exists', async () => {
      const { controller, connections, request } = buildController();
      connections.get.mockResolvedValueOnce({
        id: 'conn-1',
        provider: 'fake',
        status: 'connected',
        phoneExternalId: '5511@s.whatsapp.net',
        configured: true,
        authorized: true,
        serviceEnabled: true,
        suspensionReason: null,
        updatedAt: new Date('2026-10-29T00:00:00Z'),
      });
      const result = await controller.get(request);
      expect(result.status).toBe('connected');
      expect(result.phoneExternalId).toBe('5511@s.whatsapp.net');
      expect(result.configured).toBe(true);
      expect(result.authorized).toBe(true);
    });

    it('routes server-side and never accepts a client-selected tenant', async () => {
      const { controller, connections, request } = buildController();
      await controller.get(request);
      expect(connections.get).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
      );
      const call = connections.get.mock.calls[0] as [TenantContext];
      const [ctx] = call;
      expect(ctx.tenantId).toBe(context.tenantId);
      expect(ctx.databaseName).toBe('sdb_tenant_a');
      expect(ctx.tenantId).not.toBe('client-chosen');
    });
  });

  describe('POST pairing / connect / disconnect / reconnect', () => {
    it('pairing starts pairing and audits success', async () => {
      const { controller, sessions, audit, request } = buildController();
      const result = await controller.pairing(request);
      expect(result.pairingCode).toBe('code-1');
      expect(sessions.startPairing).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
        'whatsapp.connection.pairing_started',
        'success',
      );
    });

    it('connect returns connection status and phone', async () => {
      const { controller, sessions, request } = buildController();
      const result = await controller.connect(request);
      expect(result.status).toBe('connected');
      expect(sessions.connect).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
      );
    });

    it('disconnect returns status and phone', async () => {
      const { controller, sessions, request } = buildController();
      const result = await controller.disconnect(request);
      expect(result.status).toBe('disconnected');
      expect(sessions.disconnect).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
      );
    });

    it('reconnect returns the connection', async () => {
      const { controller, sessions, request } = buildController();
      const result = await controller.reconnect(request);
      expect(result.status).toBe('connected');
      expect(sessions.reconnect).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: context.tenantId }),
      );
    });
  });

  describe('server-side authorization (requireAdmin)', () => {
    it('allows tenant_admin to manage the connection', async () => {
      const { controller, request } = buildController('tenant_admin');
      await expect(controller.pairing(request)).resolves.toBeDefined();
    });

    it('denies tenant_member with a forbidden problem', async () => {
      const { controller, sessions, request } =
        buildController('tenant_member');
      await expect(controller.pairing(request)).rejects.toMatchObject(
        forbiddenProblem(
          'Only tenant_admin may manage the WhatsApp connection.',
        ),
      );
      expect(sessions.startPairing).not.toHaveBeenCalled();
    });

    it('denies tenant_member on connect, disconnect and reconnect', async () => {
      const { controller, sessions, request } =
        buildController('tenant_member');
      await expect(controller.connect(request)).rejects.toThrow();
      await expect(controller.disconnect(request)).rejects.toThrow();
      await expect(controller.reconnect(request)).rejects.toThrow();
      expect(sessions.connect).not.toHaveBeenCalled();
      expect(sessions.disconnect).not.toHaveBeenCalled();
      expect(sessions.reconnect).not.toHaveBeenCalled();
    });
  });
});
