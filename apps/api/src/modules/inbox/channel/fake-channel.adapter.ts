import {
  ChannelPort,
  ChannelDispatchOutcome,
  ChannelFailureKind,
  ChannelInboundEvent,
  ChannelOutboundRequest,
  parseChannelInboundEvent,
} from './inbox-channel.port';

/**
 * INBOX-03 deterministic, network-free fake adapter.
 *
 * It exists for unit tests and demonstrations only: `productionProvider` is
 * false and `adapterId` is `fake`, so it can never be mistaken for a real
 * provider. Every response is a pure function of the request (plus the
 * explicitly configured failure plan), with no clock, randomness or I/O.
 */
export interface FakeChannelAdapterOptions {
  /** Number of dispatches that fail before the next one succeeds. */
  failuresBeforeSuccess?: number;
  failureReason?: ChannelFailureKind;
}

export class FakeChannelAdapter implements ChannelPort {
  readonly adapterId = 'fake';
  readonly productionProvider = false;

  private failuresRemaining: number;
  private readonly failureReason: ChannelFailureKind;

  constructor(options: FakeChannelAdapterOptions = {}) {
    const failures = options.failuresBeforeSuccess ?? 0;
    if (!Number.isInteger(failures) || failures < 0) {
      throw new Error('failuresBeforeSuccess must be a non-negative integer');
    }
    this.failuresRemaining = failures;
    this.failureReason = options.failureReason ?? 'provider_error';
  }

  /** Builds a normalized inbound event exactly like a real adapter would. */
  createInboundEvent(input: unknown): ChannelInboundEvent {
    return parseChannelInboundEvent(input);
  }

  dispatchOutbound(
    request: ChannelOutboundRequest,
  ): Promise<ChannelDispatchOutcome> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      return Promise.resolve({
        deliveryStatus: 'failed',
        failureReason: this.failureReason,
      });
    }
    return Promise.resolve({
      deliveryStatus: 'dispatched',
      externalId: `fake:${request.messageId}`,
    });
  }
}
