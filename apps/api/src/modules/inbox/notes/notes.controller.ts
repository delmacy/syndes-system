import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import { parseUuidParam } from '../../core-crm/crm-dtos';
import { tenantOf } from '../../core-crm/crm-request';
import { parseCreateInboxNoteDto } from '../inbox-dtos';
import { NotesService, type InboxNoteResult } from './notes.service';

/**
 * INBOX-02 private note route (PRD-002 frozen contract).
 *
 * A note is internal-only: it is persisted in `inbox_private_notes` and this
 * route never touches the outbound channel port, so note content can never be
 * delivered to an external provider.
 */
@Controller('api/v1/inbox/conversations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post(':id/notes')
  create(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<InboxNoteResult> {
    return this.notes.create(
      tenantOf(request),
      parseUuidParam(id, 'id'),
      parseCreateInboxNoteDto(body),
    );
  }
}
