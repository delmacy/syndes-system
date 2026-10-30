import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { validationProblem } from '../../core-crm/crm-problem-details';
import {
  InboxRealtimeAuthorizer,
  tenantMembershipInactiveProblem,
} from './inbox-realtime.authorizer';
import {
  INBOX_REALTIME_MAX_EXPLICIT_SUBSCRIPTIONS,
  type InboxRealtimeEvent,
} from './inbox-realtime.contracts';

export const INBOX_REALTIME_CONFIG = Symbol('INBOX_REALTIME_CONFIG');
export const INBOX_REALTIME_DEFAULT_REVALIDATE_MS = 30_000;

export interface InboxRealtimeConfig {
  /** How often open streams are membership-revalidated and heartbeated. */
  revalidateMs: number;
}

/**
 * Membership revalidation interval. Out-of-range or non-numeric values fail
 * closed; they can only make the safety net slower than 30 s up to a bounded
 * maximum, never disable it.
 */
export function readInboxRealtimeConfig(
  env: NodeJS.ProcessEnv,
): InboxRealtimeConfig {
  const raw = env.INBOX_REALTIME_REVALIDATE_MS?.trim();
  if (!raw) return { revalidateMs: INBOX_REALTIME_DEFAULT_REVALIDATE_MS };
  if (!/^\d+$/.test(raw)) {
    throw new Error('INBOX_REALTIME_REVALIDATE_MS must be an integer');
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 300_000) {
    throw new Error(
      'INBOX_REALTIME_REVALIDATE_MS must be between 1000 and 300000',
    );
  }
  return { revalidateMs: parsed };
}

export type InboxRealtimeCloseReason =
  'revoked' | 'client_disconnected' | 'shutdown';

/**
 * Transport sink owned by the WebSocket gateway. The hub never touches a
 * socket directly, so the same authorization/fan-out logic is unit-testable
 * without an HTTP server.
 */
export interface InboxRealtimeSink {
  event(event: InboxRealtimeEvent): void;
  heartbeat(occurredAt: string): void;
  closed(reason: InboxRealtimeCloseReason): void;
}

export interface InboxRealtimeSubscription {
  close(): void;
}

interface InternalSubscription {
  context: TenantContext;
  conversationIds: ReadonlySet<string> | null;
  sink: InboxRealtimeSink;
  closed: boolean;
}

/**
 * INBOX-04 realtime fan-out for the single Node process of the MVP.
 *
 * Protocol/session rules:
 * - the session is the existing authenticated WebSocket handshake (identity +
 *   trusted tenant routing); no tenant/database selector ever reaches this hub;
 * - membership and `customer_scope` are re-validated per subscriber on every
 *   delivered event, not only when the socket was opened, so a revoked
 *   membership ends delivery and closes the socket;
 * - a subscriber only receives conversations its CURRENT scope authorizes;
 *   an event for another tenant is never visible because the conversation
 *   lookup itself runs in the subscriber's tenant database;
 * - the hub keeps no replay buffer: reconnect is served by the durable REST
 *   API (PRD-002 contract).
 *
 * Horizontal scaling note: fan-out is in-process. The MVP API is a single
 * instance; multiple replicas would need a durable broadcast (PostgreSQL
 * LISTEN/NOTIFY) and are explicitly out of scope until that becomes real.
 */
@Injectable()
export class InboxRealtimeHub implements OnModuleDestroy {
  private readonly logger = new Logger(InboxRealtimeHub.name);
  private readonly subscriptions = new Set<InternalSubscription>();
  private readonly revalidateMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly authorizer: InboxRealtimeAuthorizer,
    @Optional()
    @Inject(INBOX_REALTIME_CONFIG)
    config?: InboxRealtimeConfig,
  ) {
    this.revalidateMs =
      config?.revalidateMs ?? readInboxRealtimeConfig(process.env).revalidateMs;
  }

  /**
   * Opens an authorized socket. With explicit conversation ids each one is
   * checked before the subscription exists; without them the subscriber
   * follows every conversation its scope permits, still filtered per event.
   */
  async open(
    context: TenantContext,
    conversationIds: readonly string[] | null,
    sink: InboxRealtimeSink,
  ): Promise<InboxRealtimeSubscription> {
    const explicit =
      conversationIds && conversationIds.length > 0
        ? new Set(conversationIds)
        : null;
    if (explicit && explicit.size > INBOX_REALTIME_MAX_EXPLICIT_SUBSCRIPTIONS) {
      throw validationProblem([
        { field: 'conversationId', rule: 'exceeds_limit' },
      ]);
    }

    let refreshed: TenantContext;
    if (explicit) {
      refreshed = await this.authorizer.assertSubscriptionsVisible(context, [
        ...explicit,
      ]);
    } else {
      const resolved = await this.authorizer.resolveMembership(context);
      if (!resolved) throw tenantMembershipInactiveProblem();
      refreshed = resolved;
    }

    const subscription: InternalSubscription = {
      context: refreshed,
      conversationIds: explicit,
      sink,
      closed: false,
    };
    this.subscriptions.add(subscription);
    this.ensureTimer();
    return { close: () => this.close(subscription, 'client_disconnected') };
  }

  /**
   * Delivers one event to every eligible subscriber. Delivery always checks
   * live membership and the subscriber's current conversation scope; an
   * empty result is the normal case for a tenant/scope mismatch.
   */
  async publish(event: InboxRealtimeEvent): Promise<void> {
    const candidates = [...this.subscriptions];
    await Promise.all(
      candidates.map((subscription) => this.deliver(subscription, event)),
    );
  }

  /**
   * Safety net for sockets that receive no events: closes revoked sessions
   * and emits a heartbeat so intermediaries keep the connection alive.
   * Exposed for deterministic tests (no fake timers required).
   */
  async revalidateAll(): Promise<void> {
    const candidates = [...this.subscriptions];
    await Promise.all(
      candidates.map(async (subscription) => {
        try {
          const refreshed = await this.authorizer.resolveMembership(
            subscription.context,
          );
          if (!refreshed) {
            this.close(subscription, 'revoked');
            return;
          }
          subscription.context = refreshed;
          subscription.sink.heartbeat(new Date().toISOString());
        } catch {
          this.logger.error(
            'Realtime membership revalidation failed; stream kept open.',
          );
        }
      }),
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const subscription of [...this.subscriptions]) {
      this.close(subscription, 'shutdown');
    }
  }

  private async deliver(
    subscription: InternalSubscription,
    event: InboxRealtimeEvent,
  ): Promise<void> {
    if (subscription.closed) return;
    try {
      const refreshed = await this.authorizer.resolveMembership(
        subscription.context,
      );
      if (!refreshed) {
        this.close(subscription, 'revoked');
        return;
      }
      subscription.context = refreshed;
      if (
        subscription.conversationIds &&
        !subscription.conversationIds.has(event.conversationId)
      ) {
        return;
      }
      if (
        !(await this.authorizer.isConversationVisible(
          refreshed,
          event.conversationId,
        ))
      ) {
        return;
      }
      if (subscription.closed) return;
      subscription.sink.event(event);
    } catch {
      // Never report a delivery that could not be authorized. The stream
      // stays open so a transient database error does not log the attendant
      // out silently; the client refetches durable state on reconnect.
      this.logger.error(
        'Realtime event delivery failed authorization; event dropped.',
      );
    }
  }

  private close(
    subscription: InternalSubscription,
    reason: InboxRealtimeCloseReason,
  ): void {
    if (subscription.closed) return;
    subscription.closed = true;
    this.subscriptions.delete(subscription);
    if (this.subscriptions.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      subscription.sink.closed(reason);
    } catch {
      this.logger.error('Realtime stream close callback failed.');
    }
  }

  /** Lazily starts one unref'd timer for all streams. */
  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.revalidateAll();
    }, this.revalidateMs);
    this.timer.unref();
  }
}
