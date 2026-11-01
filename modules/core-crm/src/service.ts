import { randomUUID } from "node:crypto";
import type { CoreKernel, ModuleDefinition } from "@syndes/core-kernel";
import type {
  CrmContext, CrmRepository, CreateOrganization, CreatePerson,
  Organization, Person, PersonOrganization,
} from "./contracts.js";
import { CrmValidationError } from "./contracts.js";
import { email, id, phone, requiredName, searchQuery, taxId, optionalText } from "./validation.js";

/** Domain modules are registered in the host, not in the framework kernel. */
export const crmModule:ModuleDefinition=Object.freeze({
  id:"crm",version:"0.1.0",dependencies:["platform"],
});

/**
 * All public business operations run inside CoreKernel.execute, so membership
 * and resource authorization are checked BEFORE selecting a tenant repository.
 * The actor is produced by the authenticated host, never by a public form.
 */
export class CrmService {
  constructor(
    private readonly kernel:CoreKernel,
    private readonly repositoryForTenant:(tenantId:string)=>Promise<CrmRepository>,
  ) {}

  private execute<T>(
    context:CrmContext,action:"read"|"write",resource:string,
    handler:(repo:CrmRepository)=>Promise<T>
  ):Promise<T>{
    return this.kernel.execute({actor:context.actor,tenantId:context.tenantId,action,resource},
      async()=>handler(await this.repositoryForTenant(context.tenantId)));
  }

  createOrganization(context:CrmContext,input:CreateOrganization):Promise<Organization>{
    const value:CreateOrganization={
      legalName:requiredName(input?.legalName,"organization name"),
      tradeName:optionalText(input?.tradeName,"trade name",160),
      taxId:taxId(input?.taxId),
    };
    return this.execute(context,"write","crm:organizations",
      repo=>repo.createOrganization(context.tenantId,context.actor.id,randomUUID(),value));
  }

  createPerson(context:CrmContext,input:CreatePerson):Promise<Person>{
    const value:CreatePerson={
      name:requiredName(input?.name,"person name"),
      email:email(input?.email),
      phone:phone(input?.phone),
    };
    return this.execute(context,"write","crm:people",
      repo=>repo.createPerson(context.tenantId,context.actor.id,randomUUID(),value));
  }

  linkPerson(context:CrmContext,personId:string,organizationId:string):Promise<PersonOrganization>{
    const p=id(personId,"person ID"),org=id(organizationId,"organization ID");
    return this.execute(context,"write","crm:relationships",
      repo=>repo.linkPerson(context.tenantId,context.actor.id,p,org));
  }

  getPerson(context:CrmContext,personId:string):Promise<Person|null>{
    const p=id(personId,"person ID");
    return this.execute(context,"read","crm:people",
      repo=>repo.getPerson(context.tenantId,p));
  }

  listPeople(context:CrmContext,query:unknown=null,limit=25):Promise<readonly Person[]>{
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new CrmValidationError("Invalid page size");
    const normalized=searchQuery(query);
    return this.execute(context,"read","crm:people",
      repo=>repo.listPeople(context.tenantId,normalized,limit));
  }

  archivePerson(context:CrmContext,personId:string):Promise<boolean>{
    const p=id(personId,"person ID");
    return this.execute(context,"write","crm:people",
      repo=>repo.archivePerson(context.tenantId,context.actor.id,p));
  }
}
