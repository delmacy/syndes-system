import type { TenantContext } from '../platform-core/identity/identity.contracts';
import { TenantCrmDatabase } from '../core-crm/tenant-crm.database';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import type { WhatsAppConnectionPatch } from './whatsapp-connection.service';

const context: TenantContext = {
  actorId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  databaseName: 'sdb_tenant_a',
  role: 'tenant_admin',
  customerScope: 'both',
};

const contextB: TenantContext = {
  ...context,
  tenantId: '00000000-0000-4000-8000-000000000003',
  databaseName: 'sdb_tenant_b',
};

function drizzleRow(overrides: Record<string, unknown> = {}) {
  return [
    {
      id: '00000000-0000-4000-8000-000000000010',
      singletonKey: 'default',
      provider: 'whatsmeow',
      status: 'disconnected',
      phoneExternalId: null,
      sessionSecretRef: null,
      configured: false,
      authorized: false,
      serviceEnabled: true,
      suspensionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    },
  ];
}

function makeDb(current: Record<string, unknown> | null) {
  const rows = drizzleRow(current ?? {});
  const select = jest.fn().mockReturnThis();
  const from = jest.fn().mockReturnThis();
  const orderBy = jest.fn().mockReturnThis();
  const limit = jest.fn().mockResolvedValue(current === null ? [] : rows);
  const insert = jest.fn().mockReturnThis();
  const values = jest.fn().mockReturnThis();
  const onConflictDoUpdate = jest.fn().mockReturnThis();
  const returning = jest.fn().mockResolvedValue(rows);
  const db = {
    select,
    from,
    orderBy,
    limit,
    insert,
    values,
    onConflictDoUpdate,
    returning,
  };
  return {
    db,
    calls: {
      select,
      from,
      orderBy,
      limit,
      insert,
      values,
      onConflictDoUpdate,
      returning,
    },
  };
}

function harness(current: Record<string, unknown> | null) {
  const { db, calls } = makeDb(current);
  const tenantDb = {
    withTenant: jest
      .fn()
      .mockImplementation((_ctx: TenantContext, cb: (db: unknown) => unknown) =>
        Promise.resolve(cb(db)),
      ),
  } as unknown as TenantCrmDatabase;
  const service = new WhatsAppConnectionService(tenantDb);
  return { service, tenantDb, db, calls };
}

describe('WhatsAppConnectionService', () => {
  it('get returns null when the tenant database has no connection', async () => {
    const { service, calls } = harness(null);
    const result = await service.get(context);
    expect(result).toBeNull();
    expect(calls.limit).toHaveBeenCalledWith(1);
  });

  it('get returns the existing connection row', async () => {
    const { service, calls } = harness({
      status: 'connected',
      phoneExternalId: '5511@s.whatsapp.net',
    });
    const result = await service.get(context);
    expect(result?.status).toBe('connected');
    expect(result?.phoneExternalId).toBe('5511@s.whatsapp.net');
    expect(calls.orderBy).toHaveBeenCalled();
    expect(calls.limit).toHaveBeenCalledWith(1);
  });

  it('setState inserts a singleton connection keyed by default when empty', async () => {
    const { service, calls } = harness(null);
    await service.setState(context, { status: 'pairing', configured: true });
    expect(calls.insert).toHaveBeenCalled();
    expect(calls.values).toHaveBeenCalledWith(
      expect.objectContaining({
        singletonKey: 'default',
        status: 'pairing',
        configured: true,
      }),
    );
    const pairingSet: unknown = expect.objectContaining({
      status: 'pairing',
      configured: true,
    });
    expect(calls.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: pairingSet }),
    );
  });

  it('setState upserts the existing singleton row instead of duplicating', async () => {
    const { service, calls } = harness({ status: 'disconnected' });
    await service.setState(context, {
      status: 'connected',
      phoneExternalId: '5511@s.whatsapp.net',
    });
    expect(calls.insert).toHaveBeenCalled();
    const connectedSet: unknown = expect.objectContaining({
      status: 'connected',
      phoneExternalId: '5511@s.whatsapp.net',
    });
    expect(calls.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: connectedSet }),
    );
  });

  it('setState preserves configured/authorized/serviceEnabled/suspensionReason when omitted', async () => {
    const { service, calls } = harness({
      status: 'disconnected',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      suspensionReason: null,
    });
    await service.setState(context, {
      status: 'connected',
      phoneExternalId: '5511@s.whatsapp.net',
    });
    expect(calls.values).toHaveBeenCalledWith(
      expect.objectContaining({
        singletonKey: 'default',
        status: 'connected',
        phoneExternalId: '5511@s.whatsapp.net',
        configured: true,
        authorized: true,
        serviceEnabled: true,
        suspensionReason: null,
      }),
    );
    const preservedSet: unknown = expect.objectContaining({
      status: 'connected',
      phoneExternalId: '5511@s.whatsapp.net',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      suspensionReason: null,
    });
    expect(calls.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: preservedSet }),
    );
  });

  it('setState applies explicit entitlement patch values', async () => {
    const { service, calls } = harness(null);
    const patch: WhatsAppConnectionPatch = {
      status: 'suspended',
      serviceEnabled: false,
      suspensionReason: 'delinquency',
    };
    await service.setState(context, patch);
    const expectedSet: unknown = expect.objectContaining({
      status: 'suspended',
      phoneExternalId: null,
      configured: false,
      authorized: false,
      serviceEnabled: false,
      suspensionReason: 'delinquency',
    });
    expect(calls.values).toHaveBeenCalledWith(
      expect.objectContaining({
        singletonKey: 'default',
        status: 'suspended',
        phoneExternalId: null,
        configured: false,
        authorized: false,
        serviceEnabled: false,
        suspensionReason: 'delinquency',
      }),
    );
    expect(calls.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expectedSet }),
    );
  });

  it('routes each tenant to its own database (tenant isolation)', async () => {
    const withTenantA = jest.fn().mockResolvedValue(null);
    const withTenantB = jest.fn().mockResolvedValue(null);
    const dbA = { withTenant: withTenantA } as unknown as TenantCrmDatabase;
    const dbB = { withTenant: withTenantB } as unknown as TenantCrmDatabase;
    const serviceA = new WhatsAppConnectionService(dbA);
    const serviceB = new WhatsAppConnectionService(dbB);
    await serviceA.get(context);
    await serviceB.get(contextB);
    expect(withTenantA).toHaveBeenCalledWith(context, expect.any(Function));
    expect(withTenantB).toHaveBeenCalledWith(contextB, expect.any(Function));
    expect(withTenantA).not.toHaveBeenCalledWith(
      contextB,
      expect.any(Function),
    );
    expect(withTenantB).not.toHaveBeenCalledWith(context, expect.any(Function));
  });

  it('setState preserves sessionSecretRef when omitted from patch', async () => {
    const { service, calls } = harness({
      status: 'connected',
      sessionSecretRef: 'ref-existing',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      suspensionReason: null,
    });
    await service.setState(context, {
      status: 'disconnected',
      phoneExternalId: '5511@s.whatsapp.net',
    });
    expect(calls.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSecretRef: 'ref-existing',
      }),
    );
  });

  it('setState applies explicit sessionSecretRef when provided', async () => {
    const { service, calls } = harness(null);
    await service.setState(context, {
      status: 'pairing',
      sessionSecretRef: 'ref-new',
      configured: true,
    });
    expect(calls.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSecretRef: 'ref-new',
      }),
    );
  });

  it('setState clears sessionSecretRef when explicitly set to null', async () => {
    const { service, calls } = harness({
      status: 'connected',
      sessionSecretRef: 'ref-old',
      configured: true,
    });
    await service.setState(context, {
      status: 'disconnected',
      sessionSecretRef: null,
    });
    expect(calls.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSecretRef: null,
      }),
    );
  });
});
