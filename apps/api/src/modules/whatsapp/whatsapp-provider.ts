export interface WhatsAppPairingResult {
  pairingCode: string;
  expiresAt: Date;
}

export interface WhatsAppProvider {
  readonly providerId: 'fake' | 'whatsmeow';
  startPairing(tenantId: string): Promise<WhatsAppPairingResult>;
  connect(tenantId: string): Promise<{ phoneExternalId: string }>;
  disconnect(tenantId: string): Promise<void>;
  sendText(
    tenantId: string,
    recipientExternalId: string,
    body: string,
  ): Promise<{ externalMessageId: string }>;
}
