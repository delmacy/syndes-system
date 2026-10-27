import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { parseListQueryParams, parseUuidParam } from '../crm-dtos';
import { tenantOf } from '../crm-request';
import { TimelineService, TimelineListResult } from './timeline.service';

/**
 * CRM-06 chronological Timeline routes (`/api/v1` per CRM-00). Events are
 * append-only history rows; every read resolves the target through the
 * server-side TenantContext and customer scope first.
 */
@Controller('api/v1/crm')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get('people/:personId/timeline')
  personTimeline(
    @Request() request: IdentityRequest,
    @Param('personId') personId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<TimelineListResult> {
    return this.timeline.personTimeline(
      tenantOf(request),
      parseUuidParam(personId, 'personId'),
      parseListQueryParams(query),
    );
  }

  @Get('organizations/:organizationId/timeline')
  organizationTimeline(
    @Request() request: IdentityRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<TimelineListResult> {
    return this.timeline.organizationTimeline(
      tenantOf(request),
      parseUuidParam(organizationId, 'organizationId'),
      parseListQueryParams(query),
    );
  }
}
