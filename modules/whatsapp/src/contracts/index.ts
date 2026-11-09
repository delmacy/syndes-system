/** Provider-independent contracts. Tenant identity must come from trusted host context. */
export type WhatsAppAccountId = string;
export type WhatsAppSessionState = "unpaired" | "pairing" | "connected" | "disconnected" | "error";
export interface WhatsAppAccount {
  readonly id: WhatsAppAccountId;
  readonly tenantId: string;
  readonly state: WhatsAppSessionState;
  readonly serviceEnabled: boolean;
}
export interface WhatsAppInbound {
  readonly accountId: WhatsAppAccountId;
  readonly externalMessageId: string;
  readonly senderExternalId: string;
  readonly body: string;
  readonly occurredAt: string;
}
export interface WhatsAppOutbound {
  readonly accountId: WhatsAppAccountId;
  readonly idempotencyKey: string;
  readonly recipientExternalId: string;
  readonly body: string;
}
export interface WhatsAppTransport {
  pair(account: WhatsAppAccount): Promise<{code?: string; qr?: string}>;
  connect(account: WhatsAppAccount): Promise<void>;
  disconnect(account: WhatsAppAccount): Promise<void>;
  send(account: WhatsAppAccount, message: WhatsAppOutbound): Promise<{externalMessageId: string}>;
}
