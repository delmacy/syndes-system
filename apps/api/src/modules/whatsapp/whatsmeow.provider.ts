import { Inject, Injectable } from '@nestjs/common';
import { WHATSAPP_CONFIG, type WhatsAppConfig } from './whatsapp.config';
import type {
  WhatsAppPairingResult,
  WhatsAppProvider,
} from './whatsapp-provider';

@Injectable()
export class WhatsmeowProvider implements WhatsAppProvider {
  readonly providerId = 'whatsmeow' as const;

  constructor(
    @Inject(WHATSAPP_CONFIG) private readonly config: WhatsAppConfig,
  ) {}

  private async request<T>(
    tenantId: string,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    if (!this.config.whatsmeowUrl)
      throw new Error('whatsapp_whatsmeow_url_missing');
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');
    if (this.config.whatsmeowToken)
      headers.set('authorization', `Bearer ${this.config.whatsmeowToken}`);
    const response = await fetch(
      `${this.config.whatsmeowUrl}/v1/tenants/${encodeURIComponent(tenantId)}${path}`,
      {
        ...init,
        headers,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      },
    );
    if (!response.ok) throw new Error(`whatsapp_whatsmeow_${response.status}`);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async startPairing(tenantId: string): Promise<WhatsAppPairingResult> {
    const result = await this.request<{
      pairingCode: string;
      expiresAt: string;
    }>(tenantId, '/pairing', { method: 'POST', body: '{}' });
    const expiresAt = new Date(result.expiresAt);
    if (!result.pairingCode || Number.isNaN(expiresAt.getTime()))
      throw new Error('whatsapp_whatsmeow_invalid_response');
    return { pairingCode: result.pairingCode, expiresAt };
  }
  connect(tenantId: string): Promise<{ phoneExternalId: string }> {
    return this.request(tenantId, '/connect', { method: 'POST', body: '{}' });
  }
  async disconnect(tenantId: string): Promise<void> {
    await this.request(tenantId, '/disconnect', { method: 'POST', body: '{}' });
  }

  sendText(
    tenantId: string,
    recipientExternalId: string,
    body: string,
  ): Promise<{ externalMessageId: string }> {
    return this.request(tenantId, '/messages', {
      method: 'POST',
      body: JSON.stringify({ recipientExternalId, body }),
    });
  }
}
