import { ForbiddenException } from '@nestjs/common';
import type { TenantContext } from '../platform-core/identity/identity.contracts';
import type { IdentityRequest } from '../platform-core/identity/identity-auth.guard';

/**
 * Core CRM controllers derive the TenantContext only from the trusted
 * server-side guards (IdentityAuthGuard + TenantContextGuard); no request
 * value ever contributes tenant or database identity.
 */
export function tenantOf(request: IdentityRequest): TenantContext {
  const tenant = request.identityContext?.tenant;
  if (!tenant) throw new ForbiddenException('Tenant context is required');
  return tenant;
}
