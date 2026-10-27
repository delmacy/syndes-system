import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { IdentityRequest } from './identity-auth.guard';
import { IdentityContextService } from './identity-context.service';
import { IdentityTokenVerifier } from './identity-token-verifier';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly verifier: IdentityTokenVerifier,
    private readonly contexts: IdentityContextService,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<IdentityRequest>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer ([^\s]+)$/i.exec(header) : null;
    if (!match) throw new UnauthorizedException();
    const identity = await this.verifier.verify(match[1]);
    if (identity.acr !== 'mfa')
      throw new ForbiddenException('Platform administrator MFA is required');
    const actor = await this.contexts.resolveActor(identity);
    if (!actor.platformAdmin) throw new ForbiddenException();
    await this.contexts.resolvePlatformAdmin(actor.id);
    request.identityContext = { actor };
    return true;
  }
}
