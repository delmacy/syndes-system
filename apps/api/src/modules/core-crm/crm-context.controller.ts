import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { IdentityAuthGuard } from '../platform-core/identity/identity-auth.guard';
import { TenantContextGuard } from '../platform-core/identity/tenant-context.guard';
import type { IdentityRequest } from '../platform-core/identity/identity-auth.guard';
import { tenantOf } from './crm-request';

@Controller('api/v1/crm/context')
@UseGuards(IdentityAuthGuard, TenantContextGuard)
export class CrmContextController {
  @Get()
  current(@Request() request: IdentityRequest) {
    const tenant = tenantOf(request);
    return { role: tenant.role, customerScope: tenant.customerScope };
  }
}
