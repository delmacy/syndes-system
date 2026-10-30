import { WhatsAppRateLimiter } from './whatsapp-rate-limiter';

describe('WhatsAppRateLimiter', () => {
  it('allows 40 messages per minute and delays the 41st for the same account', () => {
    const limiter = new WhatsAppRateLimiter();
    for (let index = 0; index < 40; index += 1) {
      expect(limiter.retryAfterMs('tenant-a', 1_000)).toBe(0);
    }
    expect(limiter.retryAfterMs('tenant-a', 1_000)).toBe(60_000);
  });

  it('keeps tenant accounts independent', () => {
    const limiter = new WhatsAppRateLimiter();
    for (let index = 0; index < 40; index += 1)
      limiter.retryAfterMs('tenant-a', 1_000);
    expect(limiter.retryAfterMs('tenant-a', 1_000)).toBeGreaterThan(0);
    expect(limiter.retryAfterMs('tenant-b', 1_000)).toBe(0);
  });

  it('recovers capacity after the one-minute window', () => {
    const limiter = new WhatsAppRateLimiter();
    for (let index = 0; index < 40; index += 1)
      limiter.retryAfterMs('tenant-a', 1_000);
    expect(limiter.retryAfterMs('tenant-a', 61_001)).toBe(0);
  });
});
