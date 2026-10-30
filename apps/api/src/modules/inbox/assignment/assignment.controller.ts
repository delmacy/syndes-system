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
import { parseInboxAssignmentUpdateDto } from '../inbox-dtos';
import {
  AssignmentService,
  type InboxAssignmentResult,
} from './assignment.service';

/**
 * INBOX-02 assignment route (PRD-002 frozen contract).
 *
 * `assigneeActorId: null` releases the conversation; a non-null value must be
 * an active membership of the session's tenant. The target membership is
 * validated server-side against the Control Plane, never trusted from input.
 */
@Controller('api/v1/inbox/conversations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class AssignmentController {
  constructor(private readonly assignment: AssignmentService) {}

  @Patch(':id/assignment')
  update(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<InboxAssignmentResult> {
    return this.assignment.update(
      tenantOf(request),
      parseUuidParam(id, 'id'),
      parseInboxAssignmentUpdateDto(body),
    );
  }
}
