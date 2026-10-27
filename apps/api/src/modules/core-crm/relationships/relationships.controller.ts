import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { parseCreateRelationshipDto, parseUuidParam } from '../crm-dtos';
import { tenantOf } from '../crm-request';
import {
  RelationshipsService,
  RelationshipResource,
} from './relationships.service';

/**
 * CRM-05 Relationship routes: a Person <-> Organization contact link is
 * addressed by its (personId, organizationId) pair; cross-tenant ids
 * resolve to 404 and `cpf`-scoped attendants are denied server-side.
 */
@Controller('api/v1/crm')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class RelationshipsController {
  constructor(private readonly relationships: RelationshipsService) {}

  @Post('relationships')
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<RelationshipResource> {
    return this.relationships.create(
      tenantOf(request),
      parseCreateRelationshipDto(body),
    );
  }

  @Get('people/:personId/relationships')
  listForPerson(
    @Request() request: IdentityRequest,
    @Param('personId') personId: string,
  ) {
    return this.relationships.listForPerson(
      tenantOf(request),
      parseUuidParam(personId, 'personId'),
    );
  }

  @Get('relationships/:personId/:organizationId')
  get(
    @Request() request: IdentityRequest,
    @Param('personId') personId: string,
    @Param('organizationId') organizationId: string,
  ): Promise<RelationshipResource> {
    return this.relationships.get(
      tenantOf(request),
      parseUuidParam(personId, 'personId'),
      parseUuidParam(organizationId, 'organizationId'),
    );
  }

  /** Removes the link; Person/Organization records are never hard deleted. */
  @Delete('relationships/:personId/:organizationId')
  remove(
    @Request() request: IdentityRequest,
    @Param('personId') personId: string,
    @Param('organizationId') organizationId: string,
  ): Promise<RelationshipResource> {
    return this.relationships.remove(
      tenantOf(request),
      parseUuidParam(personId, 'personId'),
      parseUuidParam(organizationId, 'organizationId'),
    );
  }
}
