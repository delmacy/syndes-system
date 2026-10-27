import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantMembershipService } from '../../platform-core/identity/tenant-membership.service';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { CustomerScope } from '../../platform-core/identity/identity.contracts';
import { tenantOf } from '../crm-request';
import { parseUuidParam } from '../crm-dtos';

function parseCustomerScope(value: unknown): CustomerScope {
  if (value === 'cpf' || value === 'pj' || value === 'both') return value;
  throw new BadRequestException({ code: 'customer_scope_invalid' });
}

@Controller('api/v1/crm/memberships')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class MembershipsController {
  constructor(private readonly memberships: TenantMembershipService) {}

  @Get()
  list(@Request() request: IdentityRequest) {
    return this.memberships.listMembers(tenantOf(request));
  }

  @Put(':actorId/scope')
  updateScope(
    @Request() request: IdentityRequest,
    @Param('actorId') actorId: string,
    @Body() body: unknown,
  ) {
    const source =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    return this.memberships.updateMemberScope(
      tenantOf(request),
      parseUuidParam(actorId, 'actorId'),
      parseCustomerScope(source.customerScope),
    );
  }
}
