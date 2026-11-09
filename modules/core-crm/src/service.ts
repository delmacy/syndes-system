import {AccessDeniedError} from "@syndes/core-kernel";
import { randomUUID } from "node:crypto";
import type { CoreKernel, ModuleDefinition } from "@syndes/core-kernel";
import type {
  CrmContext, CrmRepository, CreateOrganization, CreatePerson,
  Organization, Person, PersonOrganization, Tag, PersonTag, Note, TimelineEntry,
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
    private readonly repositoryForTenant:(tenantId:string,organizationId?:string)=>Promise<CrmRepository>,
  ) {}

  private execute<T>(
    context:CrmContext,action:"read"|"write",resource:string,
    handler:(repo:CrmRepository)=>Promise<T>
  ):Promise<T>{
    if(process.env.SYNDES_MULTI_ORG_ENABLED==="true"&&!context.organizationId)
      throw new AccessDeniedError();
    if(action==="write"&&context.scopeWriteAllowed===false)throw new AccessDeniedError();
    return this.kernel.execute({actor:context.actor,tenantId:context.tenantId,action,resource},
      async()=>handler(await this.repositoryForTenant(context.tenantId,context.organizationId)));
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

  listPeople(context:CrmContext,query:unknown=null,limit=25,offset=0):Promise<readonly Person[]>{
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new CrmValidationError("Invalid page size");
    if(!Number.isInteger(offset)||offset<0||offset>100000)throw new CrmValidationError("Invalid offset");
    const normalized=searchQuery(query);
    return this.execute(context,"read","crm:people",
      repo=>repo.listPeople(context.tenantId,normalized,limit,offset));
  }

  archivePerson(context:CrmContext,personId:string):Promise<boolean>{
    const p=id(personId,"person ID");
    return this.execute(context,"write","crm:people",
      repo=>repo.archivePerson(context.tenantId,context.actor.id,p));
  }

  createTag(context:CrmContext,label:unknown):Promise<Tag>{
    const normalized=requiredName(label,"tag");
    if(normalized.length>64)throw new CrmValidationError("Tag too long");
    return this.execute(context,"write","crm:tags",
      repo=>repo.createTag(context.tenantId,context.actor.id,randomUUID(),normalized));
  }

  tagPerson(context:CrmContext,personId:string,tagId:string):Promise<PersonTag>{
    const person=id(personId,"person ID"),tag=id(tagId,"tag ID");
    return this.execute(context,"write","crm:tags",
      repo=>repo.tagPerson(context.tenantId,context.actor.id,person,tag));
  }

  createNote(context:CrmContext,personId:string,body:unknown):Promise<Note>{
    const person=id(personId,"person ID");
    if(typeof body!=="string")throw new CrmValidationError("Invalid note body");
    const normalized=body.replace(/\r\n?/g,"\n").trim();
    if(!normalized||normalized.length>5000||/[\x00-\x08\x0b-\x1f\x7f]/.test(normalized)){
      throw new CrmValidationError("Invalid note body");
    }
    return this.execute(context,"write","crm:notes",
      repo=>repo.createNote(context.tenantId,context.actor.id,randomUUID(),person,normalized));
  }

  listNotes(context:CrmContext,personId:string,limit=50):Promise<readonly Note[]>{
    const person=id(personId,"person ID");
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new CrmValidationError("Invalid notes size");
    return this.execute(context,"read","crm:notes",
      repo=>repo.listNotes(context.tenantId,person,limit));
  }

  listTimeline(context:CrmContext,personId:string,limit=50):Promise<readonly TimelineEntry[]>{
    const person=id(personId,"person ID");
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new CrmValidationError("Invalid timeline size");
    return this.execute(context,"read","crm:people",
      repo=>repo.listTimeline(context.tenantId,person,limit));
  }
}
