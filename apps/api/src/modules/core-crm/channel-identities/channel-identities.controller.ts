import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { parseUuidParam } from '../crm-dtos';
import {
  parseUpsertChannelIdentityDto,
  type ChannelIdentityResource,
} from './channel-identity-dtos';
import { tenantOf } from '../crm-request';
import { ChannelIdentitiesService } from './channel-identities.service';

/**
 * CRM-06 ChannelIdentity routes: external identities are always expressed
 * as a sub-resource of a tenant-scoped Person; the upsert stores external
 * metadata only and never touches the confirmed CRM name.
 */
@Controller('api/v1/crm/people/:personId/channel-identities')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class ChannelIdentitiesController {
  constructor(private readonly channelIdentities: ChannelIdentitiesService) {}

  @Get()
  list(
    @Request() request: IdentityRequest,
    @Param('personId') personId: string,
  ): Promise<{ items: ChannelIdentityResource[] }> {
    return this.channelIdentities.list(
      tenantOf(request),
      parseUuidParam(personId, 'personId'),
    );
  }

  @Put()
  upsert(
    @Request() request: IdentityRequest,
    @Param('personId') personId: string,
    @Body() body: unknown,
  ): Promise<ChannelIdentityResource> {
    return this.channelIdentities.upsert(
      tenantOf(request),
      parseUuidParam(personId, 'personId'),
      parseUpsertChannelIdentityDto(body),
    );
  }
}
