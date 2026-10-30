import { Injectable } from '@nestjs/common';

/** Sliding-window limiter: 40 outbound messages per minute per account. */
@Injectable()
export class WhatsAppRateLimiter {
  static readonly limit = 40;
  static readonly windowMs = 60_000;
  private readonly attempts = new Map<string, number[]>();

  retryAfterMs(accountId: string, now = Date.now()): number {
    const cutoff = now - WhatsAppRateLimiter.windowMs;
    const active = (this.attempts.get(accountId) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    this.attempts.set(accountId, active);
    if (active.length < WhatsAppRateLimiter.limit) {
      active.push(now);
      return 0;
    }
    return Math.max(1, active[0] + WhatsAppRateLimiter.windowMs - now);
  }
}
