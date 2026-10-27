import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { tenantOf } from '../crm-request';
import { parseSearchQueryParams } from './search-dtos';
import { CrmSearchService } from './search.service';

@Controller('api/v1/crm/search')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class CrmSearchController {
  constructor(private readonly searchService: CrmSearchService) {}

  @Get()
  search(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.searchService.search(
      tenantOf(request),
      parseSearchQueryParams(query),
    );
  }
}
