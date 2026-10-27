import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import {
  parseCreateOrganizationDto,
  parseListQueryParams,
  parseUpdateOrganizationDto,
  parseUuidParam,
} from '../crm-dtos';
import { tenantOf } from '../crm-request';
import {
  OrganizationListResult,
  OrganizationsService,
  OrganizationResource,
} from './organizations.service';

/**
 * CRM-05 Organization routes (`/api/v1` per CRM-00). Tenant context comes
 * only from the server-side guards; ids are tenant-scoped record UUIDs, so
 * another tenant's records resolve to 404, never conflict/confidentiality.
 */
@Controller('api/v1/crm/organizations')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<OrganizationListResult> {
    return this.organizations.list(
      tenantOf(request),
      parseListQueryParams(query),
    );
  }

  @Get(':id')
  get(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
  ): Promise<OrganizationResource> {
    return this.organizations.get(
      tenantOf(request),
      parseUuidParam(id, 'organizationId'),
    );
  }

  @Post()
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<OrganizationResource> {
    return this.organizations.create(
      tenantOf(request),
      parseCreateOrganizationDto(body),
    );
  }

  @Patch(':id')
  update(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<OrganizationResource> {
    return this.organizations.update(
      tenantOf(request),
      parseUuidParam(id, 'organizationId'),
      parseUpdateOrganizationDto(body),
    );
  }

  /** Soft archive (no hard delete in the MVP). */
  @Delete(':id')
  archive(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
  ): Promise<OrganizationResource> {
    return this.organizations.archive(
      tenantOf(request),
      parseUuidParam(id, 'organizationId'),
    );
  }
}
