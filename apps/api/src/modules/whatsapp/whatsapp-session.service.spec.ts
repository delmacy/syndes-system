import type { TenantContext } from '../platform-core/identity/identity.contracts';
import type { WhatsAppConfig } from './whatsapp.config';
import type {
  WhatsAppConnectionPatch,
  WhatsAppConnectionService,
} from './whatsapp-connection.service';
import type { FakeWhatsAppProvider } from './fake-whatsapp.provider';
import type { WhatsmeowProvider } from './whatsmeow.provider';
import { WhatsAppSessionService } from './whatsapp-session.service';

const logMock = jest.fn<(message: unknown) => void>();

jest.mock('@nestjs/common', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const actual = jest.requireActual('@nestjs/common');
  const LoggerMock = jest.fn().mockImplementation(() => ({
    log: logMock,
    error: jest.fn(),
    warn: jest.fn(),
  }));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...actual,
    Logger: LoggerMock,
  };
});

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  return String(JSON.stringify(value));
}

function allLogMessages(): string[] {
  return logMock.mock.calls.map(([message]) => safeString(message));
}

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
  const startPairing = jest.fn().mockResolvedValue({
    pairingCode: 'fake-pairing-code-abc',
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  const sendText = jest.fn().mockResolvedValue({
    externalMessageId: 'fake-msg-id',
  });
  const fake = {
    disconnect,
    connect,
    startPairing,
    sendText,
  } as unknown as FakeWhatsAppProvider;
  const service = new WhatsAppSessionService(
    config,
    { get, setState } as unknown as WhatsAppConnectionService,
    fake,
    {} as WhatsmeowProvider,
  );
  return {
    service,
    get,
    setState,
    disconnect,
    connect,
    startPairing,
    sendText,
  };
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

describe('WhatsAppSessionService WA-02 log sanitization', () => {
  it('never logs the pairing code or QR-derived secret', async () => {
    const test = harness({
      status: 'disconnected',
      configured: false,
      authorized: false,
      serviceEnabled: true,
    });
    const pairing = await test.service.startPairing(context);
    const messages = allLogMessages();
    expect(messages.join(' | ')).not.toContain(pairing.pairingCode);
    expect(messages.join(' | ')).not.toContain('fake-');
    expect(messages.some((m) => /code=\[redacted\]/.test(m))).toBe(true);
  });

  it('never logs recipient or message body on outbound send', async () => {
    const test = harness({
      status: 'connected',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await test.service.sendText(
      context,
      '5511999999999@s.whatsapp.net',
      'confidential body',
    );
    const messages = allLogMessages();
    expect(messages.join(' | ')).not.toContain('5511999999999@s.whatsapp.net');
    expect(messages.join(' | ')).not.toContain('confidential body');
    expect(messages.some((m) => /recipient=\[redacted\]/.test(m))).toBe(true);
  });
});

describe('WhatsAppSessionService WA-02 session preservation', () => {
  it('reconnect preserves configuration and session identity', async () => {
    const test = harness({
      status: 'connected',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    const result = await test.service.reconnect(context);
    expect(test.connect).toHaveBeenCalledWith(context.tenantId);
    expect(test.setState).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        status: 'connected',
        authorized: true,
        phoneExternalId: '5511@s.whatsapp.net',
        serviceEnabled: true,
        suspensionReason: null,
      }),
    );
    expect(result).toMatchObject({
      status: 'connected',
      phoneExternalId: '5511@s.whatsapp.net',
    });
  });

  it('restart keeps the session secret ref segregated (never exposed)', async () => {
    const test = harness({
      status: 'connected',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await test.service.disconnect(context);
    await test.service.reconnect(context);
    const messages = allLogMessages();
    expect(messages.join(' | ')).not.toContain('secret_ref');
    expect(messages.join(' | ')).not.toContain('sessionSecret');
    expect(test.disconnect).toHaveBeenCalledWith(context.tenantId);
    expect(test.connect).toHaveBeenCalledWith(context.tenantId);
  });
});

describe('WhatsAppSessionService WA-02 entitlement idempotency', () => {
  it('reactivation is idempotent when the session is already active', async () => {
    const test = harness({
      status: 'connected',
      configured: true,
      authorized: true,
      serviceEnabled: true,
      phoneExternalId: '5511@s.whatsapp.net',
    });
    await test.service.reactivateAfterPayment(context);
    await test.service.reactivateAfterPayment(context);
    // Idempotent: an already-active session is not re-provisioned via the provider.
    expect(test.connect).not.toHaveBeenCalled();
    expect(test.setState).toHaveBeenCalledTimes(2);
    expect(test.setState).toHaveBeenLastCalledWith(
      context,
      expect.objectContaining({
        status: 'connected',
        serviceEnabled: true,
        suspensionReason: null,
      }),
    );
  });

  it('reactivation is idempotent when only the gateway flag is restored', async () => {
    const test = harness({
      status: 'disconnected',
      configured: true,
      authorized: false,
      serviceEnabled: true,
      phoneExternalId: null,
    });
    await test.service.reactivateAfterPayment(context);
    await test.service.reactivateAfterPayment(context);
    expect(test.connect).not.toHaveBeenCalled();
    expect(test.setState).toHaveBeenCalledTimes(2);
    expect(test.setState).toHaveBeenLastCalledWith(
      context,
      expect.objectContaining({
        status: 'disconnected',
        serviceEnabled: true,
        suspensionReason: null,
      }),
    );
  });
});
