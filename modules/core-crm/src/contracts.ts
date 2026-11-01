import type { Actor } from "@syndes/core-kernel";

export type Organization = Readonly<{
  id: string;
  tenantId: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  archivedAt: string | null;
}>;

export type Person = Readonly<{
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
}>;

export type PersonOrganization = Readonly<{
  tenantId: string;
  personId: string;
  organizationId: string;
}>;

export type CreateOrganization = Readonly<{
  legalName: string;
  tradeName?: string | null;
  taxId?: string | null;
}>;

export type CreatePerson = Readonly<{
  name: string;
  email?: string | null;
  phone?: string | null;
}>;

export type Tag = Readonly<{id:string;tenantId:string;label:string}>;
export type PersonTag = Readonly<{tenantId:string;personId:string;tagId:string}>;
export type Note = Readonly<{
  id:string;tenantId:string;personId:string;body:string;createdBy:string;createdAt:string;
}>;
export type TimelineEntry = Readonly<{
  id:number;tenantId:string;personId:string;actorId:string;action:string;recordedAt:string;
}>;

export type CrmContext = Readonly<{actor:Actor;tenantId:string}>;

export interface CrmRepository {
  createOrganization(tenantId:string,actorId:string,id:string,input:CreateOrganization):Promise<Organization>;
  createPerson(tenantId:string,actorId:string,id:string,input:CreatePerson):Promise<Person>;
  linkPerson(tenantId:string,actorId:string,personId:string,organizationId:string):Promise<PersonOrganization>;
  getPerson(tenantId:string,id:string):Promise<Person|null>;
  listPeople(tenantId:string,query:string|null,limit:number):Promise<readonly Person[]>;
  archivePerson(tenantId:string,actorId:string,id:string):Promise<boolean>;
  createTag(tenantId:string,actorId:string,id:string,label:string):Promise<Tag>;
  tagPerson(tenantId:string,actorId:string,personId:string,tagId:string):Promise<PersonTag>;
  createNote(tenantId:string,actorId:string,id:string,personId:string,body:string):Promise<Note>;
  listTimeline(tenantId:string,personId:string,limit:number):Promise<readonly TimelineEntry[]>;

}

/** Only the host controls this mapping. A tenant database never comes from a client supplied DSN. */
export type TenantDatabase = Readonly<{
  tenantId:string;
  query(sql:string,values:readonly unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
}>;

export interface TrustedTenantDatabaseProvider {
  resolve(tenantId:string):Promise<TenantDatabase>;
}

export class CrmValidationError extends Error {
  constructor(message:string){super(message);this.name="CrmValidationError";}
}

export class TenantDatabaseMismatchError extends Error {
  constructor(){super("Trusted database mapping mismatch");this.name="TenantDatabaseMismatchError";}
}
