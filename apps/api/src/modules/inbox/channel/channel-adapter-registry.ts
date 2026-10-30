import { Injectable } from '@nestjs/common';
import { validationProblem } from '../../core-crm/crm-problem-details';
import type { InboxChannel } from '../inbox-dtos';
import type { ChannelAdapter } from './inbox-channel.contracts';

/**
 * INBOX-03 adapter registry: resolves the outbound adapter for a persisted
 * conversation channel. Production providers enter ONLY through
 * `registerProductionAdapter` and must self-declare `productionProvider`;
 * demo registrations refuse such adapters, so the deterministic test/demo
 * fake can never take a production slot. Until PRD-003 provides a real
 * adapter the registry stays empty and public replies keep their honest
 * `pending` delivery status.
 */
@Injectable()
export class ChannelAdapterRegistry {
  private readonly adapters = new Map<InboxChannel, ChannelAdapter>();

  /**
   * Demo/test registration only. Requires a self-declared non-production
   * adapter and refuses `unknown`/disabled channels, which are supposed to
   * remain honestly `pending`, never "sent" through a fake.
   */
  registerDemoAdapter(channel: InboxChannel, adapter: ChannelAdapter): void {
    if (channel === 'unknown') {
      throw validationProblem([{ field: 'channel', rule: 'invalid_value' }]);
    }
    if (adapter.productionProvider) {
      throw validationProblem([
        { field: 'adapter', rule: 'demo_adapter_cannot_be_production' },
      ]);
    }
    this.adapters.set(channel, adapter);
  }

  /** Production registration (PRD-003+): requires a production provider. */
  registerProductionAdapter(
    channel: InboxChannel,
    adapter: ChannelAdapter,
  ): void {
    if (channel === 'unknown') {
      throw validationProblem([{ field: 'channel', rule: 'invalid_value' }]);
    }
    if (!adapter.productionProvider) {
      throw validationProblem([
        { field: 'adapter', rule: 'production_adapter_required' },
      ]);
    }
    this.adapters.set(channel, adapter);
  }

  /** Undefined means "no provider for this channel yet" — never an error. */
  adapterFor(channel: InboxChannel): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }
}
