import {createParamDecorator,type ExecutionContext} from "@nestjs/common";
import type {RequestedOperationalScope} from "@syndes/core-kernel";

/** Headers are only LOOKUP KEYS, never authoritative ownership.
 * Duplicate/array values or partial selections will be rejected in SQL.
 * With both headers absent, legacy single-default context remains.
 */
export const SelectedScope=createParamDecorator((_data:unknown,ctx:ExecutionContext):RequestedOperationalScope|undefined=>{
 const h=ctx.switchToHttp().getRequest<{headers:Record<string,unknown>}>().headers;
 const organizationId=h["x-syndes-organization-id"];
 const workspaceId=h["x-syndes-workspace-id"];
 if(organizationId===undefined&&workspaceId===undefined)return undefined;
 return {organizationId,workspaceId};
});
