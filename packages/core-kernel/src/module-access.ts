import type {Actor, AuthorizationRequest} from "./contracts.js";
import {AccessDeniedError} from "./contracts.js";

/** Module availability is an operator-controlled Control Plane decision, not a browser claim. */
export type ModuleAccessRequest = Readonly<{
  actor: Actor;
  tenantId: string;
  moduleId: string;
}>;

/** A true result requires entitlement, installed schema/version, enabled state and dependencies. */
export interface ModuleAccessPort {
  canExecuteModule(request: ModuleAccessRequest): Promise<boolean>;
}

export type ModuleAuthorizationRequest = AuthorizationRequest & Readonly<{
  moduleId: string;
}>;

/** Fail closed on missing port, malformed context, denied state and provider outages.
 * This gate is invoked by the host BEFORE any module-specific DB lookup or handler.
 * It does not replace tenant membership, operational scope or resource-level OpenFGA.
 */
export async function requireModuleAccess(
  port: ModuleAccessPort | undefined,
  request: ModuleAccessRequest,
): Promise<void> {
  if (!port || !request || !request.actor ||
      typeof request.tenantId !== "string" || !request.tenantId.trim() ||
      typeof request.moduleId !== "string" ||
      !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(request.moduleId)) {
    throw new AccessDeniedError();
  }
  try {
    if (await port.canExecuteModule(Object.freeze({...request})) !== true) {
      throw new AccessDeniedError();
    }
  } catch {
    throw new AccessDeniedError();
  }
}
