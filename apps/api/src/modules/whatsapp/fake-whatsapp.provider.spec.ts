import { FakeWhatsAppProvider } from './fake-whatsapp.provider';

describe('FakeWhatsAppProvider', () => {
  it('creates ephemeral pairing and connects one tenant', async () => {
    const provider = new FakeWhatsAppProvider();
    const pairing = await provider.startPairing('tenant-1');
    expect(pairing.pairingCode).toMatch(/^fake-/);
    expect(pairing.expiresAt.getTime()).toBeGreaterThan(Date.now());
    await expect(provider.connect('tenant-1')).resolves.toEqual({
      phoneExternalId: 'fake:tenant-1',
    });
    await expect(provider.startPairing('tenant-1')).rejects.toThrow(
      'whatsapp_already_connected',
    );
    const sent = await provider.sendText(
      'tenant-1',
      '5511999999999@s.whatsapp.net',
      'hello',
    );
    expect(sent.externalMessageId).toMatch(/^fake-/);
    await provider.disconnect('tenant-1');
    await expect(provider.startPairing('tenant-1')).resolves.toBeDefined();
  });
});
