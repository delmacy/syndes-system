import {
  Injectable,
  type ExecutionContext,
  type HttpException,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { tenantOf } from '../../core-crm/crm-request';
import type { TenantContext } from '../../platform-core/identity/identity.contracts';
import { parseInboxRealtimeQuery } from './inbox-realtime.dto';

/**
 * INBOX-04 WebSocket handshake session resolver.
 *
 * The handshake is an ordinary HTTP request, so it is authenticated by the
 * SAME two guards as every Inbox REST route, in the same order:
 * IdentityAuthGuard (bearer token -> provisioned actor) and TenantContextGuard
 * (trusted ingress host assertion -> tenant/database/role/customer_scope).
 *
 * Nothing from the WebSocket URL can select a tenant: only the repeated
 * `conversationId` filter is accepted, and it is an in-tenant record reference
 * that the hub re-authorizes. The trusted session remains the sole source of
 * tenant/database identity, and no client frame is needed to establish it.
 */
@Injectable()
export class InboxRealtimeSessionResolver {
  constructor(
    private readonly identityGuard: IdentityAuthGuard,
    private readonly tenantGuard: TenantContextGuard,
  ) {}

  async resolve(
    request: IncomingMessage,
    url: URL,
  ): Promise<{ context: TenantContext; conversationIds: string[] }> {
    const candidate = request as IdentityRequest & {
      query?: Record<string, unknown>;
      body?: unknown;
    };
    // ExecutionContext only ever exposes switchToHttp(); the guards are reused
    // verbatim instead of duplicating their authentication/tenant rules.
    candidate.query = parseSearchParams(url.searchParams);
    candidate.body = undefined;
    const execution = httpExecutionContext(candidate);
    await this.identityGuard.canActivate(execution);
    await this.tenantGuard.canActivate(execution);
    const { conversationIds } = parseInboxRealtimeQuery(candidate.query);
    return { context: tenantOf(candidate), conversationIds };
  }
}

/** RFC 6749-style repeated query parameters become arrays, as Express does. */
function parseSearchParams(
  params: URLSearchParams,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  params.forEach((value, key) => {
    const current = query[key];
    if (current === undefined) {
      query[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      query[key] = [current, value];
    }
  });
  return query;
}

function httpExecutionContext(request: IncomingMessage): ExecutionContext {
  const httpArguments = {
    getRequest: <T = unknown>() => request as T,
    getResponse: <T = unknown>() => undefined as T,
    getNext: <T = unknown>() => undefined as T,
  };
  return {
    getClass: <T = unknown>() => undefined as T,
    getHandler: <T = unknown>() => undefined as T,
    getArgs: <T = unknown>() => [request] as T,
    getArgByIndex: <T = unknown>(index: number) =>
      ([request] as unknown[])[index] as T,
    switchToHttp: () => httpArguments,
    switchToRpc: () => ({
      getData: <T = unknown>() => undefined as T,
      getContext: <T = unknown>() => undefined as T,
      getPattern: <T = unknown>() => undefined as T,
    }),
    switchToWs: () => ({
      getClient: <T = unknown>() => undefined as T,
      getData: <T = unknown>() => undefined as T,
      getPattern: <T = unknown>() => undefined as T,
    }),
    getType: <T extends string = 'http'>() => 'http' as T,
  };
}

/** HTTP status of an exception thrown by a reused guard, if it carries one. */
export function handshakeHttpStatus(error: unknown): number {
  const httpException = error as HttpException | undefined;
  return typeof httpException?.getStatus === 'function'
    ? httpException.getStatus()
    : 500;
}
