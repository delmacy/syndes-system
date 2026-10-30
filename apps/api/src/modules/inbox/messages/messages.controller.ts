import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { parseUuidParam } from '../../core-crm/crm-dtos';
import { tenantOf } from '../../core-crm/crm-request';
import {
  parseCreateInboxMessageDto,
  parseIdempotencyKeyHeader,
  parseInboxMessageListQuery,
} from '../inbox-dtos';
import {
  MessagesService,
  type InboxPublicMessageResult,
  type InboxTimelineEntry,
} from './messages.service';

/**
 * INBOX-02 message history and public replies (PRD-002 frozen routes).
 *
 * History is the durable merge of public messages and private notes with a
 * deterministic `(created_at, id)` order and an id-based cursor. A public
 * reply requires `Idempotency-Key`; the response reports the persisted
 * delivery state and never claims delivery without adapter confirmation.
 */
@Controller('api/v1/inbox/conversations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get(':id/messages')
  list(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
  ): Promise<InboxTimelineEntry[]> {
    return this.messages.list(
      tenantOf(request),
      parseUuidParam(id, 'id'),
      parseInboxMessageListQuery(query),
    );
  }

  @Post(':id/messages')
  create(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<InboxPublicMessageResult> {
    return this.messages.create(
      tenantOf(request),
      parseUuidParam(id, 'id'),
      parseCreateInboxMessageDto(body),
      parseIdempotencyKeyHeader(idempotencyKey),
    );
  }
}
