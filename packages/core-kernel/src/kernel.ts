import type {
  Actor, AuthorizationPort, AuthorizationRequest, TenancyPort,
} from "./contracts.js";
import { AccessDeniedError } from "./contracts.js";
import { ModuleRegistry, type ModuleDefinition } from "./module-registry.js";
import {requireModuleAccess,type ModuleAccessPort,type ModuleAuthorizationRequest} from "./module-access.js";

export interface CoreKernelOptions {
  readonly modules: readonly ModuleDefinition[];
  readonly tenancy: TenancyPort;
  readonly authorization: AuthorizationPort;
  /** Required for new per-tenant module authorization path, optional for legacy callers. */
  readonly moduleAccess?: ModuleAccessPort;
}

/**
 * Only orchestration and authorization live here.
 * CRM, WhatsApp and storage drivers live outside this reusable package.
 */
export class CoreKernel {
  private readonly registry: ModuleRegistry;
  private readonly tenancy: TenancyPort;
  private readonly authorization: AuthorizationPort;
  private readonly moduleAccess: ModuleAccessPort | undefined;
  private started?: Promise<void>;

  constructor(options: CoreKernelOptions) {
    if (!options?.tenancy || !options?.authorization || !options?.modules) {
      throw new TypeError("Tenancy, authorization and modules are required");
    }
    this.registry = new ModuleRegistry(options.modules);
    this.tenancy = options.tenancy;
    this.authorization = options.authorization;
    this.moduleAccess = options.moduleAccess;
  }

  start(): Promise<void> {
    if (!this.started) {
      // The rejected promise remains rejected: a partially initialized kernel
      // must be recreated rather than retrying hooks with possible side effects.
      this.started = this.initialize();
    }
    return this.started;
  }

  private async initialize(): Promise<void> {
    const modules = this.registry.ordered();
    for (const module of modules) {
      await module.initialize?.(Object.freeze({ moduleId: module.id }));
    }
  }

  /**
   * The host must authenticate the actor before invoking this method.
   * Both tenant membership and resource-level authorization must allow access.
   * Failures/timeouts deny execution; no handler runs on an indeterminate check.
   */
  /** New opt-in path: membership + resource FGA + module eligibility must all allow.
   * No existing endpoint is switched to this method until the Control Plane adapter exists.
   */
  async executeModule<T>(request:ModuleAuthorizationRequest,
    handler:(authorized:Readonly<ModuleAuthorizationRequest>)=>Promise<T>|T):Promise<T>{
    if(!this.registry.has(request?.moduleId))throw new AccessDeniedError();
    return this.execute(request,async authorized=>{
      await requireModuleAccess(this.moduleAccess,{actor:authorized.actor,tenantId:authorized.tenantId,moduleId:request.moduleId});
      return handler(Object.freeze({...authorized,moduleId:request.moduleId}));
    });
  }

  async execute<T>(
    request: AuthorizationRequest,
    handler: (authorized: Readonly<AuthorizationRequest>) => Promise<T> | T,
  ): Promise<T> {
    if (!this.started) throw new Error("Kernel has not started");
    await this.started;
    if (!isValidRequest(request)) throw new AccessDeniedError();
    // Check membership first, so resource authorization cannot bypass tenancy.
    if (await this.tenancy.canAccessTenant({
      actor: request.actor,
      tenantId: request.tenantId,
    }) !== true) throw new AccessDeniedError();
    if (await this.authorization.canAccess({
      actor: request.actor,
      tenantId: request.tenantId,
      action: request.action,
      resource: request.resource,
    }) !== true) throw new AccessDeniedError();

    return handler(Object.freeze({
      ...request,
      actor: Object.freeze({ ...request.actor }),
    }));
  }
}

function isValidActor(actor: Actor | undefined): actor is Actor {
  return !!actor && typeof actor.id === "string" && actor.id.trim() !== "" &&
    (actor.kind === "user" || actor.kind === "service");
}

function isValidRequest(request: AuthorizationRequest | undefined): request is AuthorizationRequest {
  return !!request && isValidActor(request.actor) &&
    typeof request.tenantId === "string" && request.tenantId.trim() !== "" &&
    typeof request.action === "string" && request.action.trim() !== "" &&
    typeof request.resource === "string" && request.resource.trim() !== "";
}
