import type { WhatsAppConfig } from './whatsapp.config';
import { WhatsmeowProvider } from './whatsmeow.provider';

const config: WhatsAppConfig = {
  enabled: true,
  bindHost: '127.0.0.1',
  port: 18083,
  webhookPath: '/api/v1/whatsapp/webhook',
  provider: 'whatsmeow',
  whatsmeowUrl: 'http://127.0.0.1:19083',
  whatsmeowToken: 'sidecar-token',
  webhookToken: 'webhook-token',
  requestTimeoutMs: 10_000,
  publicBaseUrl: null,
  maxConnectionsPerTenant: 1,
};

function fetchUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe('WhatsmeowProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('authenticates a private pairing request and parses the expiry', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          pairingCode: 'qr-private',
          expiresAt: '2026-10-30T12:00:00.000Z',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const result = await new WhatsmeowProvider(config).startPairing('tenant-1');
    expect(result.expiresAt).toBeInstanceOf(Date);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer sidecar-token',
    );
    expect(fetchUrl(fetchMock.mock.calls[0][0])).toContain(
      '/v1/tenants/tenant-1/pairing',
    );
  });

  it('allows time for Whatsmeow to emit the next QR during renewal', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          pairingCode: 'qr-rotated',
          expiresAt: '2026-10-30T12:00:20.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await new WhatsmeowProvider(config).startPairing('tenant-1');

    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  it('keeps ordinary WhatsApp operations on the configured request timeout', async () => {
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phoneExternalId: '5511@s.whatsapp.net' }), {
        status: 200,
      }),
    );

    await new WhatsmeowProvider(config).connect('tenant-1');

    expect(timeout).toHaveBeenCalledWith(config.requestTimeoutMs);
  });

  it('accepts a 204 disconnect response without parsing JSON', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      new WhatsmeowProvider(config).disconnect('tenant-1'),
    ).resolves.toBeUndefined();
  });

  it('never forwards a tenant without URL encoding', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ phoneExternalId: 'fake' }), {
        status: 200,
      }),
    );
    await new WhatsmeowProvider(config).connect('../tenant');
    expect(fetchUrl(fetchMock.mock.calls[0][0])).toContain(
      '/v1/tenants/..%2Ftenant/connect',
    );
  });
});
