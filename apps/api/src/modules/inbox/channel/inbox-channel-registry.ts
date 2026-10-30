import { Injectable } from '@nestjs/common';
import { validationProblem } from '../../core-crm/crm-problem-details';
import type { InboxChannel } from '../inbox-dtos';
import { isPersistedInboxChannel } from './inbox-channel.contracts';

/**
 * INBOX-03 trusted channel registry (server-side).
 *
 * The only path from a channel delivery to a tenant: a binding token
 * registered server-side (provisioning / trusted admin surface) resolves to
 * exactly one tenant id, its non-secret tenant database name and the
 * product channel. Provider payloads NEVER carry a tenant, database or
 * routing selector — `ingest` receives the binding token as a separate
 * server-side argument, and the payload cannot influence this resolution.
 *
 * MVP note: bindings are registered in-process (no repository persistence
 * yet); durable channel configuration for the real WhatsApp/e-mail channels
 * arrives with those modules. Every persisted idempotency/delivery state
 * lives in the tenant database regardless of this lifetime.
 */

export interface ChannelBindingRegistrationInput {
  /** Opaque token the trusted adapter surface presents per registration. */
  bindingToken: string;
  tenantId: string;
  databaseName: string;
  productChannel: InboxChannel;
}

export interface ChannelBindingRecord {
  bindingToken: string;
  tenantId: string;
  databaseName: string;
  productChannel: InboxChannel;
}

const DATABASE_NAME_MAX_LENGTH = 100;
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function databaseNameField(raw: string): string {
  if (
    typeof raw !== 'string' ||
    raw.length === 0 ||
    raw.length > DATABASE_NAME_MAX_LENGTH ||
    !/^[A-Za-z0-9_]+$/.test(raw)
  ) {
    throw validationProblem([{ field: 'databaseName', rule: 'invalid_value' }]);
  }
  return raw;
}

@Injectable()
export class InboxChannelRegistry {
  private readonly bindings = new Map<string, ChannelBindingRecord>();

  /**
   * Trusted server-side registration. Idempotent only for byte-identical
   * configurations; reusing a token for another tenant/channel/database is
   * rejected instead of being silently rebound.
   */
  registerServerSide(
    input: ChannelBindingRegistrationInput,
  ): ChannelBindingRecord {
    if (typeof input.tenantId !== 'string' || !isValidUuid(input.tenantId)) {
      throw validationProblem([{ field: 'tenantId', rule: 'invalid_value' }]);
    }
    if (!isPersistedInboxChannel(input.productChannel)) {
      throw validationProblem([
        { field: 'productChannel', rule: 'invalid_value' },
      ]);
    }
    const record: ChannelBindingRecord = {
      bindingToken: input.bindingToken,
      tenantId: input.tenantId,
      databaseName: databaseNameField(input.databaseName),
      productChannel: input.productChannel,
    };
    const existing = this.bindings.get(input.bindingToken);
    if (
      existing &&
      (existing.tenantId !== record.tenantId ||
        existing.databaseName !== record.databaseName ||
        existing.productChannel !== record.productChannel)
    ) {
      throw validationProblem([
        { field: 'bindingToken', rule: 'already_bound_conflict' },
      ]);
    }
    this.bindings.set(input.bindingToken, record);
    return record;
  }

  /** Null for unknown tokens — callers treat it as an unusable delivery. */
  resolve(bindingToken: string): ChannelBindingRecord | null {
    return this.bindings.get(bindingToken) ?? null;
  }

  /** Size/14 audit helper for demo/tests: bindings are never exported. */
  get registeredCount(): number {
    return this.bindings.size;
  }
}
