import { Injectable } from '@nestjs/common';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import type { ChannelDispatchOutcome } from '../inbox/channel/inbox-channel.contracts';
import { WhatsAppRateLimiter } from './whatsapp-rate-limiter';
import { WhatsAppSessionService } from './whatsapp-session.service';

@Injectable()
export class WhatsAppOutboundQueue {
  private readonly tails = new Map<string, Promise<void>>();

  constructor(
    private readonly sessions: WhatsAppSessionService,
    private readonly limiter: WhatsAppRateLimiter,
  ) {}

  dispatch(
    context: TenantContext,
    recipientExternalId: string,
    body: string,
  ): Promise<ChannelDispatchOutcome> {
    const previous = this.tails.get(context.tenantId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const tail = previous.then(() => next);
    this.tails.set(context.tenantId, tail);
    return previous
      .then(() => this.attempt(context, recipientExternalId, body))
      .finally(() => {
        release();
        if (this.tails.get(context.tenantId) === tail)
          this.tails.delete(context.tenantId);
      });
  }

  private async attempt(
    context: TenantContext,
    recipientExternalId: string,
    body: string,
  ): Promise<ChannelDispatchOutcome> {
    let waitMs = this.limiter.retryAfterMs(context.tenantId);
    while (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      waitMs = this.limiter.retryAfterMs(context.tenantId);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.sessions.sendText(
          context,
          recipientExternalId,
          body,
        );
        return {
          deliveryStatus: 'dispatched',
          externalId: result.externalMessageId,
        };
      } catch {
        if (attempt === 2)
          return { deliveryStatus: 'failed', failureReason: 'provider_error' };
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
    return { deliveryStatus: 'failed', failureReason: 'provider_error' };
  }
}
