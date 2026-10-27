import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { parseCreateTagDto } from './tags-dtos';
import { parseListQueryParams, parseUuidParam } from '../crm-dtos';
import { tenantOf } from '../crm-request';
import {
  TagsService,
  TagAssignmentResource,
  TagListResult,
  TagResource,
} from './tags.service';

/**
 * CRM-06 Tag routes (`/api/v1` per CRM-00). Tags may exist only as labels
 * and their assignments may attach only to Person or Organization targets
 * that the actor's customer scope exposes.
 */
@Controller('api/v1/crm/tags')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<TagListResult> {
    return this.tags.list(tenantOf(request), parseListQueryParams(query));
  }

  @Post()
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<TagResource> {
    return this.tags.create(tenantOf(request), parseCreateTagDto(body));
  }

  @Get(':tagId')
  get(
    @Request() request: IdentityRequest,
    @Param('tagId') tagId: string,
  ): Promise<TagResource> {
    return this.tags.get(tenantOf(request), parseUuidParam(tagId, 'tagId'));
  }

  @Put(':tagId/people/:personId')
  assignPerson(
    @Request() request: IdentityRequest,
    @Param('tagId') tagId: string,
    @Param('personId') personId: string,
  ): Promise<TagAssignmentResource> {
    return this.tags.assignToPerson(
      tenantOf(request),
      parseUuidParam(tagId, 'tagId'),
      parseUuidParam(personId, 'personId'),
    );
  }

  @Delete(':tagId/people/:personId')
  detachPerson(
    @Request() request: IdentityRequest,
    @Param('tagId') tagId: string,
    @Param('personId') personId: string,
  ): Promise<TagAssignmentResource> {
    return this.tags.detachFromPerson(
      tenantOf(request),
      parseUuidParam(tagId, 'tagId'),
      parseUuidParam(personId, 'personId'),
    );
  }

  @Put(':tagId/organizations/:organizationId')
  assignOrganization(
    @Request() request: IdentityRequest,
    @Param('tagId') tagId: string,
    @Param('organizationId') organizationId: string,
  ): Promise<TagAssignmentResource> {
    return this.tags.assignToOrganization(
      tenantOf(request),
      parseUuidParam(tagId, 'tagId'),
      parseUuidParam(organizationId, 'organizationId'),
    );
  }

  @Delete(':tagId/organizations/:organizationId')
  detachOrganization(
    @Request() request: IdentityRequest,
    @Param('tagId') tagId: string,
    @Param('organizationId') organizationId: string,
  ): Promise<TagAssignmentResource> {
    return this.tags.detachFromOrganization(
      tenantOf(request),
      parseUuidParam(tagId, 'tagId'),
      parseUuidParam(organizationId, 'organizationId'),
    );
  }
}
