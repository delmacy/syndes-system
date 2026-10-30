import { Module } from '@nestjs/common';
import type { Pool } from 'pg';
import {
  CONTROL_PLANE_DATABASE,
  PlatformCoreModule,
} from '../platform-core/platform-core.module';
import { CoreCrmModule } from '../core-crm/core-crm.module';

import { ConversationsService } from './conversations/conversations.service';
import { MessagesService } from './messages/messages.service';
import { NotesService } from './notes/notes.service';
import { AssignmentService } from './assignment/assignment.service';
import { StatusService } from './status/status.service';

import { ConversationsController } from './conversations/conversations.controller';
import { MessagesController } from './messages/messages.controller';
import { NotesController } from './notes/notes.controller';
import { AssignmentController } from './assignment/assignment.controller';
import { StatusController } from './status/status.controller';
import { ConversationAttachmentsController } from './attachments/conversation-attachments.controller';
import { AttachmentsController } from './attachments/attachments.controller';
import { InboxRealtimeGateway } from './realtime/inbox-realtime.gateway';

import { InboxMembershipPort } from './inbox-membership.port';
import { InboxAuditWriter } from './inbox-audit';

import { ChannelIngressService } from './channel/channel-ingress.service';
import { ChannelOutboundService } from './channel/channel-outbound.service';
import { ChannelAdapterRegistry } from './channel/channel-adapter-registry';
import { InboxChannelRegistry } from './channel/inbox-channel-registry';

import { InboxRealtimeAuthorizer } from './realtime/inbox-realtime.authorizer';
import { InboxRealtimeSessionResolver } from './realtime/inbox-realtime.session';
import {
  INBOX_REALTIME_CONFIG,
  InboxRealtimeHub,
  readInboxRealtimeConfig,
} from './realtime/inbox-realtime.hub';
import {
  INBOX_ATTACHMENT_CONFIG,
  readInboxAttachmentConfig,
} from './attachments/inbox-attachment.config';
import { InboxAttachmentStorage } from './attachments/inbox-attachment.storage';
import { InboxAttachmentsService } from './attachments/inbox-attachments.service';

/**
 * INBOX-02/03/04 Inbox feature boundary (PRD-002).
 *
 * Tenant persistence runs exclusively through Core CRM's existing
 * `TenantCrmDatabase.withTenant(context, …)` — the same single
 * server-side-resolved tenant database as the CRM — and no tenant table or
 * SQL in this module contains tenant identifiers. Every controller
 * requires IdentityAuthGuard + TenantContextGuard; the TenantContext is
 * derived only from the trusted request (`tenantOf`) and never from any
 * client value, and the Control Plane membership port validates assignment
 * targets (INBOX-01).
 *
 * INBOX-03 channel port: `ChannelIngressService` (inbound) is invoked only
 * by trusted internal callers that already resolved the `TenantContext`
 * server-side; its strict-schema payload can never name a tenant/database,
 * and identity mapping uses each tenant database's own
 * `crm_channel_identities`. `ChannelOutboundService` dispatches persisted
 * outbound messages through the adapter registry; private notes never reach
 * it. Until PRD-003 provides a real adapter, production keeps its honest
 * `pending` delivery status.
 *
 * INBOX-04 realtime + attachments: `InboxRealtimeGateway` serves the
 * authenticated WebSocket endpoint (`/api/v1/inbox/realtime`) on the existing
 * Nest HTTP server. The handshake reuses IdentityAuthGuard +
 * TenantContextGuard, so the trusted session (never a client value) resolves
 * tenant/database; the hub re-validates active membership and the current
 * `customer_scope` before every delivery (and periodically for idle sockets),
 * closing revoked sessions. There is no client tenant selector and no
 * realtime replay buffer: reconnect rebuilds state through the durable REST
 * API. Events carry only resource pointers (ids/state), never content.
 * Attachment metadata lives in this tenant database; bytes live under a
 * private per-tenant directory (configuration validated at startup, outside
 * any webroot, symlink- and escape-checked per operation) and are addressed by
 * a server-generated key only, served exclusively by the authorized download
 * route.
 */
@Module({
  imports: [PlatformCoreModule, CoreCrmModule],
  controllers: [
    ConversationsController,
    MessagesController,
    NotesController,
    AssignmentController,
    StatusController,
    ConversationAttachmentsController,
    AttachmentsController,
  ],
  providers: [
    ConversationsService,
    MessagesService,
    NotesService,
    AssignmentService,
    StatusService,
    {
      provide: InboxMembershipPort,
      useFactory: (pool: Pool) => new InboxMembershipPort(pool),
      inject: [CONTROL_PLANE_DATABASE],
    },
    InboxAuditWriter,
    InboxChannelRegistry,
    ChannelIngressService,
    ChannelOutboundService,
    ChannelAdapterRegistry,
    InboxRealtimeAuthorizer,
    InboxRealtimeSessionResolver,
    InboxRealtimeGateway,
    InboxRealtimeHub,
    {
      provide: INBOX_REALTIME_CONFIG,
      useFactory: () => readInboxRealtimeConfig(process.env),
    },
    InboxAttachmentStorage,
    InboxAttachmentsService,
    {
      provide: INBOX_ATTACHMENT_CONFIG,
      useFactory: () => readInboxAttachmentConfig(process.env),
    },
  ],
  exports: [ChannelIngressService, ChannelAdapterRegistry],
})
export class InboxModule {}
