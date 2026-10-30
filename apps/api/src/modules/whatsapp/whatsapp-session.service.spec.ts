import type { TenantContext } from '../platform-core/identity/identity.contracts';
import type { WhatsAppConfig } from './whatsapp.config';
import type {
  WhatsAppConnectionPatch,
  WhatsAppConnectionService,
} from './whatsapp-connection.service';
import type { FakeWhatsAppProvider } from './fake-whatsapp.provider';
import type { WhatsmeowProvider } from './whatsmeow.provider';
import { WhatsAppSessionService } from './whatsapp-session.service';

const context: TenantContext = {
  actorId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  databaseName: 'sdb_tenant',
  role: 'tenant_admin',
  customerScope: 'both',
};

const config = {
  enabled: true,
  provider: 'fake',
} as WhatsAppConfig;

function harness(current: Record<string, unknown> | null) {
  const get = jest.fn().mockResolvedValue(current);
  const setState = jest
    .fn()
    .mockImplementation((_context, patch: WhatsAppConnectionPatch) =>
      Promise.resolve({ ...current, ...patch }),
    );
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const connect = jest
    .fn()
    .mockResolvedValue({ phoneExternalId: '5511@s.whatsapp.net' });
  const fake = { disconnect, connect } as unknown as FakeWhatsAppProvider;
  const service = new WhatsAppSessionService(
    config,
    { get, setState } as unknown as WhatsAppConnectionService,
    fake,
    {} as WhatsmeowProvider,
  );
  return { service, get, setState, disconnect, connect };
}

describe('WhatsAppSessionService billing lifecycle', () => {
  it('suspends before disconnecting and preserves authorization/session identity', async () => {
    const test = harness({
      status: 'connected',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await test.service.suspendForDelinquency(context);
    expect(test.setState).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        status: 'suspended',
        serviceEnabled: false,
        suspensionReason: 'delinquency',
      }),
    );
    expect(test.disconnect).toHaveBeenCalledWith(context.tenantId);
  });

  it('blocks reconnect while billing keeps the gateway suspended', async () => {
    const test = harness({
      status: 'suspended',
      configured: true,
      authorized: true,
      serviceEnabled: false,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await expect(test.service.reconnect(context)).rejects.toThrow(
      'whatsapp_suspended',
    );
    expect(test.connect).not.toHaveBeenCalled();
  });

  it('blocks pairing and direct connect while billing keeps the gateway suspended', async () => {
    const test = harness({
      status: 'suspended',
      configured: true,
      authorized: true,
      serviceEnabled: false,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await expect(test.service.startPairing(context)).rejects.toThrow(
      'whatsapp_suspended',
    );
    await expect(test.service.connect(context)).rejects.toThrow(
      'whatsapp_suspended',
    );
    expect(test.connect).not.toHaveBeenCalled();
  });

  it('does not clear a delinquency suspension when disconnect is requested', async () => {
    const current = {
      status: 'suspended',
      configured: true,
      authorized: true,
      serviceEnabled: false,
      suspensionReason: 'delinquency',
      phoneExternalId: '5511@s.whatsapp.net',
    };
    const test = harness(current);
    await expect(test.service.disconnect(context)).resolves.toEqual(current);
    expect(test.disconnect).toHaveBeenCalledWith(context.tenantId);
    expect(test.setState).not.toHaveBeenCalled();
  });

  it('reactivates an authorized session without requiring a new pairing', async () => {
    const test = harness({
      status: 'suspended',
      configured: true,
      authorized: true,
      serviceEnabled: false,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await test.service.reactivateAfterPayment(context);
    expect(test.connect).toHaveBeenCalledWith(context.tenantId);
    expect(test.setState).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        status: 'connected',
        authorized: true,
        serviceEnabled: true,
        suspensionReason: null,
      }),
    );
  });
});
