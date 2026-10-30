import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  WhatsAppPairingResult,
  WhatsAppProvider,
} from './whatsapp-provider';

@Injectable()
export class FakeWhatsAppProvider implements WhatsAppProvider {
  readonly providerId = 'fake' as const;
  private readonly connected = new Set<string>();

  startPairing(tenantId: string): Promise<WhatsAppPairingResult> {
    if (this.connected.has(tenantId)) {
      return Promise.reject(new Error('whatsapp_already_connected'));
    }
    return Promise.resolve({
      pairingCode: `fake-${randomBytes(12).toString('base64url')}`,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
  }

  connect(tenantId: string): Promise<{ phoneExternalId: string }> {
    this.connected.add(tenantId);
    return Promise.resolve({ phoneExternalId: `fake:${tenantId}` });
  }

  disconnect(tenantId: string): Promise<void> {
    this.connected.delete(tenantId);
    return Promise.resolve();
  }

  sendText(tenantId: string, recipientExternalId: string, body: string) {
    if (!this.connected.has(tenantId))
      return Promise.reject(new Error('whatsapp_not_connected'));
    const stable = Buffer.from(`${tenantId}:${recipientExternalId}:${body}`)
      .toString('base64url')
      .slice(0, 48);
    return Promise.resolve({ externalMessageId: `fake-${stable}` });
  }
}
