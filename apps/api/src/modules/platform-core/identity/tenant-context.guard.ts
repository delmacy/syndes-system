import {
  CanActivate,
  BadRequestException,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { IdentityRequest } from './identity-auth.guard';
import { IdentityContextService } from './identity-context.service';
import { hasClientTenantSelector } from './tenant-selector-input';
import {
  VALIDATED_TENANT_HOST_HEADER,
  VALIDATED_TENANT_SIGNATURE_HEADER,
  VALIDATED_TENANT_TIME_HEADER,
  verifyValidatedHost,
} from './trusted-ingress';

/** This header is injected by the trusted ingress, which must strip all inbound copies. */
const ingressSecret = () => process.env.INGRESS_SIGNING_SECRET;

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly contexts: IdentityContextService) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<IdentityRequest>();
    const actor = request.identityContext?.actor;
    if (!actor) throw new UnauthorizedException();
    if (hasClientTenantSelector(request.headers, request.query, request.body)) {
      throw new BadRequestException('Tenant routing is derived server-side');
    }
    if (actor.platformAdmin) throw new NotFoundException('Tenant not found');
    const host = request.headers[VALIDATED_TENANT_HOST_HEADER];
    const timestamp = request.headers[VALIDATED_TENANT_TIME_HEADER];
    const signature = request.headers[VALIDATED_TENANT_SIGNATURE_HEADER];
    const secret = ingressSecret();
    if (
      typeof host !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof signature !== 'string' ||
      !secret ||
      !verifyValidatedHost(host, timestamp, signature, secret)
    )
      throw new NotFoundException('Tenant not found');
    const tenant = await this.contexts.resolveTenantContext(actor.id, host);
    request.identityContext = { actor, tenant };
    return true;
  }
}
