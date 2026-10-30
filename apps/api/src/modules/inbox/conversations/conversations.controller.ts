import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { parseUuidParam } from '../../core-crm/crm-dtos';
import { tenantOf } from '../../core-crm/crm-request';
import { parseInboxListQuery } from '../inbox-dtos';
import {
  ConversationsService,
  type InboxConversationListResult,
  type InboxConversationResource,
} from './conversations.service';

/**
 * INBOX-02 conversation queue and detail (PRD-002 frozen routes).
 *
 * Every tenant value comes from the trusted request context resolved by the
 * guards. Filters and pagination apply only after `customer_scope`, and an
 * unauthorized/foreign conversation id resolves to the same 404.
 */
@Controller('api/v1/inbox/conversations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<InboxConversationListResult> {
    return this.conversations.list(
      tenantOf(request),
      parseInboxListQuery(query),
    );
  }

  @Get(':id')
  detail(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
  ): Promise<InboxConversationResource> {
    return this.conversations.get(tenantOf(request), parseUuidParam(id, 'id'));
  }
}
