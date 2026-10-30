import {
  Body,
  Controller,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { parseUuidParam } from '../../core-crm/crm-dtos';
import { tenantOf } from '../../core-crm/crm-request';
import { parseInboxStatusUpdateDto } from '../inbox-dtos';
import { StatusService, type InboxStatusResult } from './status.service';

/**
 * INBOX-02 conversation status route (PRD-002 frozen contract).
 *
 * Only `open`, `pending` and `resolved` are accepted; the DTO rejects any
 * other value before the service runs, and the tenant database constraint
 * remains the final guard.
 */
@Controller('api/v1/inbox/conversations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Patch(':id/status')
  update(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<InboxStatusResult> {
    return this.status.update(
      tenantOf(request),
      parseUuidParam(id, 'id'),
      parseInboxStatusUpdateDto(body),
    );
  }
}
