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
  parseCreatePersonDto,
  parseListQueryParams,
  parseUpdatePersonDto,
  parseUuidParam,
} from '../crm-dtos';
import { tenantOf } from '../crm-request';
import {
  PeopleService,
  PersonListResult,
  PersonResource,
} from './people.service';

/**
 * CRM-05 Person routes (`/api/v1` per CRM-00). List/detail/update paths
 * apply the actor's fixed customer scope server-side; cross-tenant ids
 * resolve to 404.
 */
@Controller('api/v1/crm/people')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<PersonListResult> {
    return this.people.list(tenantOf(request), parseListQueryParams(query));
  }

  @Get(':id')
  get(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
  ): Promise<PersonResource> {
    return this.people.get(tenantOf(request), parseUuidParam(id, 'personId'));
  }

  @Post()
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<PersonResource> {
    return this.people.create(tenantOf(request), parseCreatePersonDto(body));
  }

  @Patch(':id')
  update(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<PersonResource> {
    return this.people.update(
      tenantOf(request),
      parseUuidParam(id, 'personId'),
      parseUpdatePersonDto(body),
    );
  }

  /** Soft archive (no hard delete in the MVP). */
  @Delete(':id')
  archive(
    @Request() request: IdentityRequest,
    @Param('id') id: string,
  ): Promise<PersonResource> {
    return this.people.archive(
      tenantOf(request),
      parseUuidParam(id, 'personId'),
    );
  }
}
