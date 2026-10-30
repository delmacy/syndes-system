import { readWhatsAppConfig } from './whatsapp.config';

describe('readWhatsAppConfig', () => {
  it('keeps the listener private and disabled by default', () => {
    expect(
      readWhatsAppConfig({ WHATSAPP_WHATSMEOW_URL: 'http://127.0.0.1:19083' }),
    ).toMatchObject({
      enabled: false,
      bindHost: '127.0.0.1',
      port: 18083,
      webhookPath: '/api/v1/whatsapp/webhook',
      provider: 'whatsmeow',
      maxConnectionsPerTenant: 1,
    });
  });

  it('accepts explicit Tailscale-controlled settings', () => {
    expect(
      readWhatsAppConfig({
        WHATSAPP_ENABLED: 'true',
        WHATSAPP_BIND_HOST: '100.75.65.12',
        WHATSAPP_PORT: '18083',
        WHATSAPP_PROVIDER: 'whatsmeow',
        WHATSAPP_WHATSMEOW_URL: 'http://127.0.0.1:19083',
        WHATSAPP_WEBHOOK_TOKEN: 'test-webhook-token',
        WHATSAPP_PUBLIC_BASE_URL: 'https://server02.tayra-delta.ts.net',
      }),
    ).toMatchObject({ enabled: true, bindHost: '100.75.65.12', port: 18083 });
  });

  it('rejects public HTTP callback URLs and invalid ports', () => {
    expect(() =>
      readWhatsAppConfig({ WHATSAPP_PUBLIC_BASE_URL: 'http://example.test' }),
    ).toThrow();
    expect(() => readWhatsAppConfig({ WHATSAPP_PORT: '99999' })).toThrow();
  });

  it('fails closed when enabled without an internal webhook token', () => {
    expect(() =>
      readWhatsAppConfig({
        WHATSAPP_ENABLED: 'true',
        WHATSAPP_WHATSMEOW_URL: 'http://127.0.0.1:19083',
      }),
    ).toThrow();
  });
});
