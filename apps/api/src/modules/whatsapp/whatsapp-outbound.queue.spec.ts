import type { TenantContext } from '../platform-core/identity/identity.contracts';
import type { WhatsAppRateLimiter } from './whatsapp-rate-limiter';
import type { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsAppOutboundQueue } from './whatsapp-outbound.queue';

const context = (tenantId: string): TenantContext => ({
  actorId: '00000000-0000-4000-8000-000000000001',
  tenantId,
  databaseName: `sdb_${tenantId.slice(-1)}`,
  role: 'tenant_admin',
  customerScope: 'both',
});

describe('WhatsAppOutboundQueue', () => {
  it('preserves FIFO order within an account', async () => {
    const calls: string[] = [];
    const sendText = jest.fn((_context, _recipient, body: string) => {
      calls.push(body);
      return Promise.resolve({ externalMessageId: `external-${body}` });
    });
    const queue = new WhatsAppOutboundQueue(
      { sendText } as unknown as WhatsAppSessionService,
      { retryAfterMs: () => 0 } as unknown as WhatsAppRateLimiter,
    );
    await Promise.all([
      queue.dispatch(
        context('00000000-0000-4000-8000-00000000000a'),
        'a',
        'first',
      ),
      queue.dispatch(
        context('00000000-0000-4000-8000-00000000000a'),
        'a',
        'second',
      ),
    ]);
    expect(calls).toEqual(['first', 'second']);
  });

  it('retries transient failures and reports the provider delivery id', async () => {
    jest.useFakeTimers();
    const sendText = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue({ externalMessageId: 'external-1' });
    const queue = new WhatsAppOutboundQueue(
      { sendText } as unknown as WhatsAppSessionService,
      { retryAfterMs: () => 0 } as unknown as WhatsAppRateLimiter,
    );
    const result = queue.dispatch(
      context('00000000-0000-4000-8000-00000000000a'),
      'a',
      'hello',
    );
    await jest.runAllTimersAsync();
    await expect(result).resolves.toEqual({
      deliveryStatus: 'dispatched',
      externalId: 'external-1',
    });
    expect(sendText).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('fails explicitly after exhausting retries', async () => {
    jest.useFakeTimers();
    const sendText = jest.fn().mockRejectedValue(new Error('down'));
    const queue = new WhatsAppOutboundQueue(
      { sendText } as unknown as WhatsAppSessionService,
      { retryAfterMs: () => 0 } as unknown as WhatsAppRateLimiter,
    );
    const result = queue.dispatch(
      context('00000000-0000-4000-8000-00000000000a'),
      'a',
      'hello',
    );
    await jest.runAllTimersAsync();
    await expect(result).resolves.toEqual({
      deliveryStatus: 'failed',
      failureReason: 'provider_error',
    });
    jest.useRealTimers();
  });
});
