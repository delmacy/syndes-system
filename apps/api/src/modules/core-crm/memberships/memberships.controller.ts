import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IdentityAuthGuard } from '../../platform-core/identity/identity-auth.guard';
import type { IdentityRequest } from '../../platform-core/identity/identity-auth.guard';
import { TenantMembershipService } from '../../platform-core/identity/tenant-membership.service';
import { TenantContextGuard } from '../../platform-core/identity/tenant-context.guard';
import type { CustomerScope } from '../../platform-core/identity/identity.contracts';
import { tenantOf } from '../crm-request';
import { parseUuidParam, UUID_PATTERN } from '../crm-dtos';

function assertValidCustomerScope(
  value: unknown,
): asserts value is CustomerScope {
  if (value !== 'cpf' && value !== 'pj' && value !== 'both') {
    throw new BadRequestException({
      code: 'customer_scope_invalid',
      errors: [{ field: 'customerScope', rule: 'invalid_value' }],
    });
  }
}

@Controller('api/v1/crm/memberships')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class MembershipsController {
  constructor(private readonly memberships: TenantMembershipService) {}

  @Post()
  async grantMember(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ) {
    const raw = body;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new BadRequestException({
        code: 'invalid_body',
        errors: [{ field: 'body', rule: 'invalid_value' }],
      });
    }

    const payload = raw as Record<string, unknown>;

    // Validate no unknown fields
    const unknownFields = Object.keys(payload).filter(
      (key) => key !== 'actorId' && key !== 'customerScope',
    );
    if (unknownFields.length) {
      throw new BadRequestException({
        code: 'unknown_field',
        errors: unknownFields.map((field) => ({
          field,
          rule: 'unknown_field',
        })),
      });
    }

    // Validate actorId is a UUID
    const actorId = payload.actorId;
    if (typeof actorId !== 'string' || !UUID_PATTERN.test(actorId)) {
      throw new BadRequestException({
        code: 'invalid_actor_id',
        errors: [{ field: 'actorId', rule: 'invalid_format' }],
      });
    }

    // Validate customerScope
    assertValidCustomerScope(payload.customerScope);

    return this.memberships.grantMember(
      tenantOf(request),
      actorId,
      payload.customerScope,
    );
  }

  @Get()
  list(@Request() request: IdentityRequest) {
    return this.memberships.listMembers(tenantOf(request));
  }

  @Delete(':actorId')
  revokeMember(
    @Request() request: IdentityRequest,
    @Param('actorId') actorId: string,
  ) {
    return this.memberships.revokeMember(
      tenantOf(request),
      parseUuidParam(actorId, 'actorId'),
    );
  }

  @Put(':actorId/scope')
  updateScope(
    @Request() request: IdentityRequest,
    @Param('actorId') actorId: string,
    @Body() body: unknown,
  ) {
    const source =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const unknownFields = Object.keys(source).filter(
      (key) => key !== 'customerScope',
    );
    if (unknownFields.length) {
      throw new BadRequestException({
        code: 'unknown_field',
        errors: unknownFields.map((field) => ({
          field,
          rule: 'unknown_field',
        })),
      });
    }
    assertValidCustomerScope(source.customerScope);
    return this.memberships.updateMemberScope(
      tenantOf(request),
      parseUuidParam(actorId, 'actorId'),
      source.customerScope,
    );
  }
}
