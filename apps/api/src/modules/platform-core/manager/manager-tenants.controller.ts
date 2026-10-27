import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../identity/platform-admin.guard';
import type { IdentityRequest } from '../identity/identity-auth.guard';
import type { AuthenticatedActor } from '../identity/identity.contracts';
import {
  AssignInitialAdminDto,
  CreateTenantDto,
  UpdateTenantDto,
  defaultListTenantsQuery,
  parseAssignInitialAdminDto,
  parseCreateTenantDto,
  parseListTenantsQuery,
  parseTenantIdParam,
  parseUpdateTenantDto,
} from './manager-dtos';
import {
  InitialAdminMembershipResource,
  ManagerTenantsService,
  TenantDetailResource,
  TenantListResult,
  TenantResource,
} from './manager-tenants.service';

/**
 * CRM-04 Platform Admin tenant management routes (`/api/v1` per CRM-00).
 *
 * Authorization: `PlatformAdminGuard` only (bearer token + Control Plane
 * `platform_admin` + required MFA `acr`). Tenant members and non-admins are
 * denied; platform administration never reaches a tenant database or any
 * CRM record.
 */
@Controller('api/v1/platform-admin/tenants')
@UseGuards(PlatformAdminGuard)
export class ManagerTenantsController {
  constructor(private readonly tenants: ManagerTenantsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>): Promise<TenantListResult> {
    const parsed = Object.keys(query ?? {}).length
      ? parseListTenantsQuery(query)
      : defaultListTenantsQuery();
    return this.tenants.list(parsed);
  }

  @Get(':tenantId')
  get(@Param('tenantId') tenantId: string): Promise<TenantDetailResource> {
    return this.tenants.getDetail(parseTenantIdParam(tenantId));
  }

  @Post()
  create(
    @Request() request: IdentityRequest,
    @Body() body: unknown,
  ): Promise<TenantResource> {
    const input: CreateTenantDto = parseCreateTenantDto(body);
    return this.tenants.create(input, this.actorOf(request).id);
  }

  @Patch(':tenantId')
  update(
    @Request() request: IdentityRequest,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
  ): Promise<TenantResource> {
    const input: UpdateTenantDto = parseUpdateTenantDto(body);
    return this.tenants.updateMetadata(
      parseTenantIdParam(tenantId),
      input,
      this.actorOf(request).id,
    );
  }

  /**
   * Idempotent provisioning start/retry (CRM-02 semantics); a ready tenant
   * is a no-op and a failed attempt resumes. Observers read state + stage +
   * sanitized failure codes from the returned resource.
   */
  @Post(':tenantId/provisioning')
  @HttpCode(HttpStatus.OK)
  provisioning(
    @Request() request: IdentityRequest,
    @Param('tenantId') tenantId: string,
  ): Promise<TenantDetailResource> {
    return this.tenants.startOrRetryProvisioning(
      parseTenantIdParam(tenantId),
      this.actorOf(request).id,
    );
  }

  /**
   * Initial `tenant_admin` membership by the exact configured Keycloak
   * issuer and subject; grants tenant membership only and never implies
   * Platform Admin CRM access.
   */
  @Post(':tenantId/initial-admin-membership')
  assignInitialAdmin(
    @Request() request: IdentityRequest,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
  ): Promise<InitialAdminMembershipResource> {
    const input: AssignInitialAdminDto = parseAssignInitialAdminDto(body);
    return this.tenants.assignInitialAdmin(
      parseTenantIdParam(tenantId),
      input,
      this.actorOf(request).id,
    );
  }

  private actorOf(request: IdentityRequest): AuthenticatedActor {
    return request.identityContext!.actor;
  }
}
