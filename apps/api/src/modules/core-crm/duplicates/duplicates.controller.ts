import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { tenantOf } from '../crm-request';
import { parseDuplicateCheckQuery } from './duplicate-dtos';
import { DuplicatesService } from './duplicates.service';

@Controller('api/v1/crm/duplicates')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class DuplicatesController {
  constructor(private readonly duplicates: DuplicatesService) {}

  @Get('possible')
  check(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.duplicates.check(
      tenantOf(request),
      parseDuplicateCheckQuery(query),
    );
  }
}
