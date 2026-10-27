import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { parseListQueryParams, parseUuidParam } from '../crm-dtos';
import { parseCreateNoteDto, parseNoteTargetQuery } from './notes-dtos';
import type { NoteResource } from './notes-dtos';
import { tenantOf } from '../crm-request';
import { NotesService } from './notes.service';

/**
 * CRM-06 Note routes (`/api/v1` per CRM-00). A note belongs to exactly
 * one Person or Organization the attendant's customer scope exposes; the
 * target must name a UUID and never a tenant/database selector.
 */
@Controller('api/v1/crm/notes')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const { personId, organizationId, ...pagination } = query;
    const target = parseNoteTargetQuery({ personId, organizationId });
    return this.notes.list(
      tenantOf(request),
      target.personId !== undefined
        ? { personId: target.personId }
        : { organizationId: target.organizationId as string },
      parseListQueryParams(pagination),
    );
  }

  @Get(':noteId')
  get(
    @Request() request: IdentityRequest,
    @Param('noteId') noteId: string,
  ): Promise<NoteResource> {
    return this.notes.get(tenantOf(request), parseUuidParam(noteId, 'noteId'));
  }

  @Post()
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<NoteResource> {
    return this.notes.create(tenantOf(request), parseCreateNoteDto(body));
  }
}
