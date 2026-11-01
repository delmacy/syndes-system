import {randomUUID} from "node:crypto";
import type {CoreKernel} from "@syndes/core-kernel";
import type {CrmContext,CreatePerson,Person,TenantDatabase,TrustedTenantDatabaseProvider,Organization} from "./contracts.js";
import {CrmValidationError,TenantDatabaseMismatchError} from "./contracts.js";
import {contactsToCsv,parseContactsCsv} from "./csv.js";
import {email,id,isUuid,optionalText,phone,requiredName,taxId,searchQuery} from "./validation.js";

export type Employee=Readonly<{id:string;tenantId:string;personId:string;jobTitle:string;active:boolean}>;
export type ChannelIdentity=Readonly<{
  id:string;tenantId:string;personId:string;channel:string;externalId:string;displayName:string|null;
}>;
export type DuplicateCandidate=Readonly<{id:string;name:string;reason:string}>;
export type ImportResult=Readonly<{imported:number}>;

export interface ExtraRepository {
  updatePerson(tenant:string,actor:string,personId:string,fields:CreatePerson):Promise<Person|null>;
  getOrganization(tenant:string,orgId:string):Promise<Organization|null>;
  listOrganizations(tenant:string,query:string|null,limit:number):Promise<readonly Organization[]>;
  updateOrganization(tenant:string,actor:string,orgId:string,fields:{legalName:string;tradeName:string|null;taxId:string|null}):Promise<Organization|null>;
  archiveOrganization(tenant:string,actor:string,orgId:string):Promise<boolean>;
  createEmployee(tenant:string,actor:string,employeeId:string,personId:string,jobTitle:string):Promise<Employee>;
  linkChannel(tenant:string,actor:string,id:string,personId:string,channel:string,externalId:string,displayName:string|null):Promise<ChannelIdentity>;
  duplicates(tenant:string,email:string|null,phone:string|null,excludeId:string|null):Promise<readonly DuplicateCandidate[]>;
  importPeople(tenant:string,actor:string,people:readonly (CreatePerson&{id:string})[]):Promise<number>;
  listExportPeople(tenant:string,limit:number):Promise<readonly Person[]>;
  listEmployees(tenant:string,limit:number):Promise<readonly Employee[]>;
  listChannels(tenant:string,personId:string,limit:number):Promise<readonly ChannelIdentity[]>;
  listPersonOrganizations(tenant:string,personId:string,limit:number):Promise<readonly Organization[]>;
  listPersonTags(tenant:string,personId:string,limit:number):Promise<readonly {id:string;label:string}[]>;
}

export class CrmExtras {
  constructor(private readonly kernel:CoreKernel,private readonly resolve:(tenantId:string)=>Promise<ExtraRepository>){}
  private run<T>(ctx:CrmContext,action:"read"|"write",resource:string,work:(db:ExtraRepository)=>Promise<T>):Promise<T>{
    return this.kernel.execute({actor:ctx.actor,tenantId:ctx.tenantId,action,resource},
      async()=>work(await this.resolve(ctx.tenantId)));
  }
  updatePerson(ctx:CrmContext,personId:string,input:CreatePerson):Promise<Person|null>{
    const p=id(personId,"person ID");
    const fields={name:requiredName(input?.name,"person name"),email:email(input?.email),phone:phone(input?.phone)};
    return this.run(ctx,"write","crm:people",db=>db.updatePerson(ctx.tenantId,ctx.actor.id,p,fields));
  }
  getOrganization(ctx:CrmContext,orgId:string):Promise<Organization|null>{
    const org=id(orgId,"organization ID");
    return this.run(ctx,"read","crm:organizations",db=>db.getOrganization(ctx.tenantId,org));
  }
  listOrganizations(ctx:CrmContext,query:unknown=null,limit=25):Promise<readonly Organization[]>{
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new CrmValidationError("Invalid page size");
    const q=searchQuery(query);
    return this.run(ctx,"read","crm:organizations",db=>db.listOrganizations(ctx.tenantId,q,limit));
  }
  updateOrganization(ctx:CrmContext,orgId:string,input:{legalName:string;tradeName?:string|null;taxId?:string|null}):Promise<Organization|null>{
    const org=id(orgId,"organization ID");
    const fields={legalName:requiredName(input?.legalName,"organization name"),
      tradeName:optionalText(input?.tradeName,"trade name",160),taxId:taxId(input?.taxId)};
    return this.run(ctx,"write","crm:organizations",db=>db.updateOrganization(ctx.tenantId,ctx.actor.id,org,fields));
  }
  archiveOrganization(ctx:CrmContext,orgId:string):Promise<boolean>{
    const org=id(orgId,"organization ID");
    return this.run(ctx,"write","crm:organizations",db=>db.archiveOrganization(ctx.tenantId,ctx.actor.id,org));
  }
  createEmployee(ctx:CrmContext,personId:string,jobTitle:unknown):Promise<Employee>{
    const p=id(personId,"person ID"),job=requiredName(jobTitle,"job title");
    return this.run(ctx,"write","crm:employees",
      db=>db.createEmployee(ctx.tenantId,ctx.actor.id,randomUUID(),p,job));
  }
  linkChannel(ctx:CrmContext,personId:string,input:{channel:string;externalId:string;displayName?:string|null}):Promise<ChannelIdentity>{
    const p=id(personId,"person ID");
    const channel=input?.channel;
    if(!["whatsapp","instagram","email"].includes(channel))throw new CrmValidationError("Invalid channel");
    const externalId=optionalText(input?.externalId,"external ID",256);
    if(!externalId)throw new CrmValidationError("Missing external ID");
    const displayName=optionalText(input?.displayName,"external display name",160);
    return this.run(ctx,"write","crm:channels",
      db=>db.linkChannel(ctx.tenantId,ctx.actor.id,randomUUID(),p,channel,externalId,displayName));
  }
  possibleDuplicates(ctx:CrmContext,input:{email?:string|null;phone?:string|null;excludeId?:string|null}):Promise<readonly DuplicateCandidate[]>{
    const em=email(input?.email),ph=phone(input?.phone);
    const excluded=input?.excludeId==null?null:id(input.excludeId,"exclude ID");
    if(!em&&!ph)throw new CrmValidationError("Specify email or phone");
    return this.run(ctx,"read","crm:people",db=>db.duplicates(ctx.tenantId,em,ph,excluded));
  }
  importCsv(ctx:CrmContext,csv:unknown):Promise<ImportResult>{
    const parsed=parseContactsCsv(csv).map(x=>({...x,id:randomUUID()}));
    return this.run(ctx,"write","crm:people",async db=>({imported:await db.importPeople(ctx.tenantId,ctx.actor.id,parsed)}));
  }
  listEmployees(ctx:CrmContext,limit=100):Promise<readonly Employee[]>{
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new CrmValidationError("Invalid employee page size");
    return this.run(ctx,"read","crm:employees",db=>db.listEmployees(ctx.tenantId,limit));
  }
  listPersonOrganizations(ctx:CrmContext,personId:string):Promise<readonly Organization[]>{
    const person=id(personId,"person ID");
    return this.run(ctx,"read","crm:organizations",
      db=>db.listPersonOrganizations(ctx.tenantId,person,25));
  }
  listPersonTags(ctx:CrmContext,personId:string):Promise<readonly {id:string;label:string}[]>{
    const person=id(personId,"person ID");
    return this.run(ctx,"read","crm:tags",
      db=>db.listPersonTags(ctx.tenantId,person,25));
  }
  listChannels(ctx:CrmContext,personId:string):Promise<readonly ChannelIdentity[]>{
    const person=id(personId,"person ID");
    return this.run(ctx,"read","crm:channels",db=>db.listChannels(ctx.tenantId,person,100));
  }
  exportCsv(ctx:CrmContext):Promise<string>{
    return this.run(ctx,"read","crm:people",async db=>contactsToCsv(await db.listExportPeople(ctx.tenantId,1000)));
  }
}

function asOrganization(row:Record<string,unknown>):Organization{
  return {id:String(row.id),tenantId:String(row.tenant_id),legalName:String(row.legal_name),
    tradeName:row.trade_name===null?null:String(row.trade_name),
    taxId:row.tax_id===null?null:String(row.tax_id),
    archivedAt:row.archived_at===null?null:String(row.archived_at)};
}
function asPerson(row:Record<string,unknown>):Person{
  return {id:String(row.id),tenantId:String(row.tenant_id),name:String(row.name),
    email:row.email===null?null:String(row.email),phone:row.phone===null?null:String(row.phone),
    archivedAt:row.archived_at===null?null:String(row.archived_at)};
}
export class PgCrmExtras implements ExtraRepository {
  constructor(private readonly db:TenantDatabase){}
  private check(tenant:string){if(!isUuid(tenant)||tenant!==this.db.tenantId)throw new TenantDatabaseMismatchError()}
  async updatePerson(t:string,a:string,p:string,v:CreatePerson):Promise<Person|null>{
    this.check(t);
    const r=await this.db.query(`WITH changed AS (
      UPDATE crm_people SET name=$3,email=$4,phone=$5
      WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL
      RETURNING id,tenant_id,name,email,phone,archived_at
    ), audit AS (INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
      SELECT tenant_id,$6,'person',id,'updated' FROM changed RETURNING id)
    SELECT c.* FROM changed c CROSS JOIN audit`,[t,p,v.name,v.email??null,v.phone??null,a]);
    return r.rows[0]?asPerson(r.rows[0]):null;
  }
  async getOrganization(t:string,id:string):Promise<Organization|null>{
    this.check(t);
    const r=await this.db.query("SELECT id,tenant_id,legal_name,trade_name,tax_id,archived_at FROM crm_organizations WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL",[t,id]);
    return r.rows[0]?asOrganization(r.rows[0]):null;
  }
  async listOrganizations(t:string,q:string|null,limit:number):Promise<readonly Organization[]>{
    this.check(t);
    const r=await this.db.query(`SELECT id,tenant_id,legal_name,trade_name,tax_id,archived_at FROM crm_organizations
      WHERE tenant_id=$1::uuid AND archived_at IS NULL AND
      ($2::text IS NULL OR legal_name ILIKE '%'||$2::text||'%' ESCAPE '\\'
       OR trade_name ILIKE '%'||$2::text||'%' ESCAPE '\\'
       OR tax_id ILIKE '%'||$2::text||'%' ESCAPE '\\')
      ORDER BY legal_name,id LIMIT $3`,[t,q,limit]);
    return r.rows.map(asOrganization);
  }
  async updateOrganization(t:string,a:string,id:string,v:{legalName:string;tradeName:string|null;taxId:string|null}):Promise<Organization|null>{
    this.check(t);
    const r=await this.db.query(`WITH changed AS (
      UPDATE crm_organizations SET legal_name=$3,trade_name=$4,tax_id=$5
      WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL
      RETURNING id,tenant_id,legal_name,trade_name,tax_id,archived_at
    ), audit AS (INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
      SELECT tenant_id,$6,'organization',id,'updated' FROM changed RETURNING id)
    SELECT c.* FROM changed c CROSS JOIN audit`,[t,id,v.legalName,v.tradeName,v.taxId,a]);
    return r.rows[0]?asOrganization(r.rows[0]):null;
  }
  async archiveOrganization(t:string,a:string,id:string):Promise<boolean>{
    this.check(t);
    const r=await this.db.query(`WITH changed AS (
      UPDATE crm_organizations SET archived_at=now()
      WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL
      RETURNING tenant_id,id
    ), audit AS (INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
      SELECT tenant_id,$3,'organization',id,'archived' FROM changed RETURNING id)
    SELECT c.id FROM changed c CROSS JOIN audit`,[t,id,a]);
    return r.rows.length>0;
  }
  async createEmployee(t:string,a:string,id:string,p:string,job:string):Promise<Employee>{
    this.check(t);
    const r=await this.db.query(`WITH created AS (
      INSERT INTO crm_employees(tenant_id,id,person_id,job_title)
      SELECT $1::uuid,$2::uuid,$3::uuid,$4
      WHERE EXISTS(SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid AND id=$3::uuid AND archived_at IS NULL)
      RETURNING tenant_id,id,person_id,job_title,active
    ), audit AS(INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
      SELECT tenant_id,$5,'person',person_id,'employee_created' FROM created RETURNING id)
    SELECT c.* FROM created c CROSS JOIN audit`,[t,id,p,job,a]);
    const row=r.rows[0];if(!row)throw new Error("Employee person not found");
    return {tenantId:t,id:String(row.id),personId:p,jobTitle:String(row.job_title),active:Boolean(row.active)};
  }
  async linkChannel(t:string,a:string,id:string,p:string,channel:string,external:string,display:string|null):Promise<ChannelIdentity>{
    this.check(t);
    const r=await this.db.query(`WITH created AS (
      INSERT INTO crm_channel_identities(tenant_id,id,person_id,channel,external_id,display_name)
      SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,$6
      WHERE EXISTS(SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid AND id=$3::uuid AND archived_at IS NULL)
      RETURNING tenant_id,id,person_id,channel,external_id,display_name
    ), audit AS(INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
      SELECT tenant_id,$7,'person',person_id,'channel_linked' FROM created RETURNING id)
    SELECT c.* FROM created c CROSS JOIN audit`,[t,id,p,channel,external,display,a]);
    const row=r.rows[0];if(!row)throw new Error("Channel identity person not found");
    return {id:String(row.id),tenantId:t,personId:p,channel:String(row.channel),
      externalId:String(row.external_id),displayName:row.display_name===null?null:String(row.display_name)};
  }
  async duplicates(t:string,em:string|null,ph:string|null,excluded:string|null):Promise<readonly DuplicateCandidate[]>{
    this.check(t);
    const r=await this.db.query(`SELECT id,name,
      CASE WHEN $2::text IS NOT NULL AND email=$2 THEN 'email'
      ELSE 'phone' END AS reason FROM crm_people
      WHERE tenant_id=$1::uuid AND archived_at IS NULL
      AND ($4::uuid IS NULL OR id<>$4::uuid)
      AND (($2::text IS NOT NULL AND email=$2)
           OR ($3::text IS NOT NULL AND phone=$3))
      ORDER BY name,id LIMIT 10`,[t,em,ph,excluded]);
    return r.rows.map(x=>({id:String(x.id),name:String(x.name),reason:String(x.reason)}));
  }
  async importPeople(t:string,a:string,people:readonly (CreatePerson&{id:string})[]):Promise<number>{
    this.check(t);
    const r=await this.db.query(`WITH input AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb)
      AS row(id uuid,name text,email text,phone text)
    ), created AS (
      INSERT INTO crm_people(id,tenant_id,name,email,phone)
      SELECT id,$2::uuid,name,email,phone FROM input
      RETURNING id,tenant_id
    ), audit AS (
      INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
      SELECT tenant_id,$3,'person',id,'imported' FROM created
      RETURNING id
    ) SELECT count(*)::int AS imported FROM audit`,[JSON.stringify(people),t,a]);
    const count=Number(r.rows[0]?.imported??0);
    if(count!==people.length)throw new Error("CRM batch import failed");
    return count;
  }
  async listEmployees(t:string,limit:number):Promise<readonly Employee[]>{
    this.check(t);
    const r=await this.db.query(`SELECT id,tenant_id,person_id,job_title,active FROM crm_employees
      WHERE tenant_id=$1::uuid ORDER BY created_at DESC,id LIMIT $2`,[t,limit]);
    return r.rows.map(row=>({id:String(row.id),tenantId:t,personId:String(row.person_id),
      jobTitle:String(row.job_title),active:Boolean(row.active)}));
  }
  async listChannels(t:string,personId:string,limit:number):Promise<readonly ChannelIdentity[]>{
    this.check(t);
    const r=await this.db.query(`SELECT id,tenant_id,person_id,channel,external_id,display_name
      FROM crm_channel_identities WHERE tenant_id=$1::uuid AND person_id=$2::uuid
      ORDER BY created_at DESC,id LIMIT $3`,[t,personId,limit]);
    return r.rows.map(row=>({id:String(row.id),tenantId:t,personId,
      channel:String(row.channel),externalId:String(row.external_id),
      displayName:row.display_name===null?null:String(row.display_name)}));
  }
  async listPersonOrganizations(t:string,personId:string,limit:number):Promise<readonly Organization[]>{
    this.check(t);
    const r=await this.db.query(`
      SELECT o.id,o.tenant_id,o.legal_name,o.trade_name,o.tax_id,o.archived_at
      FROM crm_person_organizations rel
      JOIN crm_organizations o ON o.tenant_id=rel.tenant_id AND o.id=rel.organization_id
      JOIN crm_people p ON p.tenant_id=rel.tenant_id AND p.id=rel.person_id
      WHERE rel.tenant_id=$1::uuid AND rel.person_id=$2::uuid
        AND p.archived_at IS NULL AND o.archived_at IS NULL
      ORDER BY o.legal_name,o.id LIMIT $3
    `,[t,personId,limit]);
    return r.rows.map(asOrganization);
  }
  async listPersonTags(t:string,personId:string,limit:number):Promise<readonly {id:string;label:string}[]>{
    this.check(t);
    const r=await this.db.query(`
      SELECT tag.id,tag.label
      FROM crm_person_tags rel
      JOIN crm_tags tag ON tag.tenant_id=rel.tenant_id AND tag.id=rel.tag_id
      JOIN crm_people p ON p.tenant_id=rel.tenant_id AND p.id=rel.person_id
      WHERE rel.tenant_id=$1::uuid AND rel.person_id=$2::uuid AND p.archived_at IS NULL
      ORDER BY tag.label,tag.id LIMIT $3
    `,[t,personId,limit]);
    return r.rows.map(row=>({id:String(row.id),label:String(row.label)}));
  }
  async listExportPeople(t:string,limit:number):Promise<readonly Person[]>{
    this.check(t);
    const r=await this.db.query(`SELECT id,tenant_id,name,email,phone,archived_at FROM crm_people
      WHERE tenant_id=$1::uuid AND archived_at IS NULL ORDER BY name,id LIMIT $2`,[t,limit+1]);
    if(r.rows.length>limit)throw new CrmValidationError("Export exceeds maximum contacts");
    return r.rows.map(asPerson);
  }
}
export class PgCrmExtrasFactory {
  constructor(private readonly provider:TrustedTenantDatabaseProvider){}
  async forTenant(t:string):Promise<ExtraRepository>{
    if(!isUuid(t))throw new TenantDatabaseMismatchError();
    const db=await this.provider.resolve(t);
    if(db.tenantId!==t)throw new TenantDatabaseMismatchError();
    return new PgCrmExtras(db);
  }
}
