import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { IdentityContextService } from './identity-context.service';
import { IdentityTokenVerifier } from './identity-token-verifier';
import type { IdentityRequestContext } from './identity.contracts';

export type IdentityRequest = Request & {
  identityContext?: IdentityRequestContext;
};

@Injectable()
export class IdentityAuthGuard implements CanActivate {
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
    const actor = await this.contexts.resolveActor(identity);
    request.identityContext = { actor };
    return true;
  }
}
