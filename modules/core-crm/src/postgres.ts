import type {
  CrmRepository, CreateOrganization, CreatePerson, Organization, Person,
  PersonOrganization, TrustedTenantDatabaseProvider, TenantDatabase,
  Tag, PersonTag, Note, TimelineEntry,
} from "./contracts.js";
import { TenantDatabaseMismatchError } from "./contracts.js";
import { isUuid } from "./validation.js";

function org(row:Record<string,unknown>):Organization {
  return {
    id:String(row.id),tenantId:String(row.tenant_id),
    legalName:String(row.legal_name),
    tradeName:row.trade_name===null?null:String(row.trade_name),
    taxId:row.tax_id===null?null:String(row.tax_id),
    archivedAt:row.archived_at===null?null:String(row.archived_at)
  };
}
function person(row:Record<string,unknown>):Person {
  return {
    id:String(row.id),tenantId:String(row.tenant_id),name:String(row.name),
    email:row.email===null?null:String(row.email),
    phone:row.phone===null?null:String(row.phone),
    archivedAt:row.archived_at===null?null:String(row.archived_at)
  };
}

/**
 * Every statement has an explicit tenant_id predicate, even though the
 * production topology also uses a different PostgreSQL database per tenant.
 * Domain mutations and their audit record are atomic in a single SQL statement.
 */
export class PgCrmRepository implements CrmRepository {
  constructor(private readonly db:TenantDatabase){}

  private check(tenantId:string):void {
    if(!isUuid(tenantId)||this.db.tenantId!==tenantId) throw new TenantDatabaseMismatchError();
  }

  async createOrganization(tenantId:string,actorId:string,id:string,input:CreateOrganization):Promise<Organization>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH created AS (
        INSERT INTO crm_organizations (id,tenant_id,legal_name,trade_name,tax_id)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5)
        RETURNING id,tenant_id,legal_name,trade_name,tax_id,archived_at
      ), audit AS (
        INSERT INTO crm_audit (tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$6,'organization',id,'created' FROM created
        RETURNING id
      )
      SELECT c.* FROM created c CROSS JOIN audit a`,
      [id,tenantId,input.legalName,input.tradeName??null,input.taxId??null,actorId]);
    if(!result.rows[0])throw new Error("CRM organization creation failed");
    return org(result.rows[0]);
  }

  async createPerson(tenantId:string,actorId:string,id:string,input:CreatePerson):Promise<Person>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH created AS (
        INSERT INTO crm_people (id,tenant_id,name,email,phone)
        VALUES ($1::uuid,$2::uuid,$3,$4,$5)
        RETURNING id,tenant_id,name,email,phone,archived_at
      ), audit AS (
        INSERT INTO crm_audit (tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$6,'person',id,'created' FROM created
        RETURNING id
      )
      SELECT c.* FROM created c CROSS JOIN audit a`,
      [id,tenantId,input.name,input.email??null,input.phone??null,actorId]);
    if(!result.rows[0])throw new Error("CRM person creation failed");
    return person(result.rows[0]);
  }

  async linkPerson(tenantId:string,actorId:string,personId:string,organizationId:string):Promise<PersonOrganization>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH linked AS (
        INSERT INTO crm_person_organizations(tenant_id,person_id,organization_id)
        SELECT $1::uuid,$2::uuid,$3::uuid
        WHERE EXISTS (
          SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL
        ) AND EXISTS (
          SELECT 1 FROM crm_organizations WHERE tenant_id=$1::uuid AND id=$3::uuid AND archived_at IS NULL
        )
        ON CONFLICT DO NOTHING
        RETURNING tenant_id,person_id,organization_id
      ), audit AS (
        INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$4,'person',person_id,'linked_organization' FROM linked
        RETURNING id
      )
      SELECT l.* FROM linked l CROSS JOIN audit a`,
      [tenantId,personId,organizationId,actorId]);
    if(result.rows[0])return {
      tenantId:String(result.rows[0].tenant_id),
      personId:String(result.rows[0].person_id),
      organizationId:String(result.rows[0].organization_id),
    };
    // Never report success for nonexistent or foreign-tenant IDs.
    throw new Error("CRM relationship not created (missing, archived or already linked)");
  }

  async getPerson(tenantId:string,id:string):Promise<Person|null>{
    this.check(tenantId);
    const result=await this.db.query(
      "SELECT id,tenant_id,name,email,phone,archived_at FROM crm_people WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL",
      [tenantId,id]);
    return result.rows[0]?person(result.rows[0]):null;
  }

  async listPeople(tenantId:string,query:string|null,limit:number,offset=0):Promise<readonly Person[]>{
    this.check(tenantId);
    const result=await this.db.query(`
      SELECT id,tenant_id,name,email,phone,archived_at FROM crm_people
      WHERE tenant_id=$1::uuid AND archived_at IS NULL
      AND ($2::text IS NULL OR name ILIKE '%' || $2::text || '%' ESCAPE '\\'
         OR email ILIKE '%' || $2::text || '%' ESCAPE '\\'
         OR phone ILIKE '%' || $2::text || '%' ESCAPE '\\'
         OR EXISTS (
           SELECT 1 FROM crm_person_tags pt
           JOIN crm_tags t ON t.tenant_id=pt.tenant_id AND t.id=pt.tag_id
           WHERE pt.tenant_id=crm_people.tenant_id
             AND pt.person_id=crm_people.id
             AND t.label ILIKE '%' || $2::text || '%' ESCAPE '\\'
         )
         OR EXISTS (
           SELECT 1 FROM crm_person_organizations po
           JOIN crm_organizations o ON o.tenant_id=po.tenant_id
                                  AND o.id=po.organization_id
           WHERE po.tenant_id=crm_people.tenant_id
             AND po.person_id=crm_people.id AND o.archived_at IS NULL
             AND (o.legal_name ILIKE '%' || $2::text || '%' ESCAPE '\\'
               OR o.trade_name ILIKE '%' || $2::text || '%' ESCAPE '\\'
               OR o.tax_id ILIKE '%' || $2::text || '%' ESCAPE '\\')
         ))
      ORDER BY name,id LIMIT $3 OFFSET $4`,[tenantId,query,limit,offset]);
    return result.rows.map(person);
  }

  async archivePerson(tenantId:string,actorId:string,id:string):Promise<boolean>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH changed AS (
        UPDATE crm_people SET archived_at=now()
        WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL
        RETURNING tenant_id,id
      ), audit AS (
        INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$3,'person',id,'archived' FROM changed
        RETURNING id
      )
      SELECT changed.id FROM changed CROSS JOIN audit`,[tenantId,id,actorId]);
    return result.rows.length>0;
  }

  async createTag(tenantId:string,actorId:string,id:string,label:string):Promise<Tag>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH created AS (
        INSERT INTO crm_tags (id,tenant_id,label,label_key)
        VALUES ($1::uuid,$2::uuid,$3,lower($3))
        RETURNING id,tenant_id,label
      ), audit AS (
        INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$4,'tag',id,'created' FROM created
        RETURNING id
      )
      SELECT c.* FROM created c CROSS JOIN audit`,[id,tenantId,label,actorId]);
    const row=result.rows[0];
    if(!row)throw new Error("CRM tag already exists");
    return {id:String(row.id),tenantId:String(row.tenant_id),label:String(row.label)};
  }

  async tagPerson(tenantId:string,actorId:string,personId:string,tagId:string):Promise<PersonTag>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH tagged AS (
        INSERT INTO crm_person_tags(tenant_id,person_id,tag_id)
        SELECT $1::uuid,$2::uuid,$3::uuid
        WHERE EXISTS (SELECT 1 FROM crm_people
          WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL)
        AND EXISTS (SELECT 1 FROM crm_tags
          WHERE tenant_id=$1::uuid AND id=$3::uuid)
        ON CONFLICT DO NOTHING
        RETURNING tenant_id,person_id,tag_id
      ), audit AS (
        INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$4,'person',person_id,'tagged' FROM tagged
        RETURNING id
      )
      SELECT t.* FROM tagged t CROSS JOIN audit`,[tenantId,personId,tagId,actorId]);
    if(!result.rows[0])throw new Error("CRM tag relation not created");
    return {tenantId,personId,tagId};
  }

  async createNote(tenantId:string,actorId:string,id:string,personId:string,body:string):Promise<Note>{
    this.check(tenantId);
    const result=await this.db.query(`
      WITH created AS (
        INSERT INTO crm_notes(id,tenant_id,person_id,body,created_by)
        SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5
        WHERE EXISTS (SELECT 1 FROM crm_people
          WHERE tenant_id=$2::uuid AND id=$3::uuid AND archived_at IS NULL)
        RETURNING id,tenant_id,person_id,body,created_by,created_at
      ), audit AS (
        INSERT INTO crm_audit(tenant_id,actor_id,entity_type,entity_id,action)
        SELECT tenant_id,$5,'person',person_id,'noted' FROM created
        RETURNING id
      )
      SELECT c.* FROM created c CROSS JOIN audit`,[id,tenantId,personId,body,actorId]);
    const row=result.rows[0];
    if(!row)throw new Error("CRM note target not found");
    return {
      id:String(row.id),tenantId:String(row.tenant_id),
      personId:String(row.person_id),body:String(row.body),
      createdBy:String(row.created_by),
      createdAt:row.created_at instanceof Date?row.created_at.toISOString():String(row.created_at)
    };
  }

  async listNotes(tenantId:string,personId:string,limit:number):Promise<readonly Note[]>{
    this.check(tenantId);
    const result=await this.db.query(`SELECT id,tenant_id,person_id,body,created_by,created_at
      FROM crm_notes WHERE tenant_id=$1::uuid AND person_id=$2::uuid
      ORDER BY created_at DESC,id DESC LIMIT $3`,[tenantId,personId,limit]);
    return result.rows.map(row=>({
      id:String(row.id),tenantId:String(row.tenant_id),personId:String(row.person_id),
      body:String(row.body),createdBy:String(row.created_by),
      createdAt:row.created_at instanceof Date?row.created_at.toISOString():String(row.created_at)
    }));
  }

  async listTimeline(tenantId:string,personId:string,limit:number):Promise<readonly TimelineEntry[]>{
    this.check(tenantId);
    const result=await this.db.query(`
      SELECT id,tenant_id,actor_id,action,recorded_at
      FROM crm_audit
      WHERE tenant_id=$1::uuid AND entity_type='person' AND entity_id=$2::uuid
      ORDER BY id DESC LIMIT $3`,[tenantId,personId,limit]);
    return result.rows.map(row=>({
      id:Number(row.id),tenantId:String(row.tenant_id),
      personId,actorId:String(row.actor_id),action:String(row.action),
      recordedAt:row.recorded_at instanceof Date?
        row.recorded_at.toISOString():String(row.recorded_at)
    }));
  }
}

export class PgCrmRepositoryFactory {
  constructor(private readonly provider:TrustedTenantDatabaseProvider){}
  async forTenant(tenantId:string):Promise<CrmRepository>{
    if(!isUuid(tenantId))throw new TenantDatabaseMismatchError();
    const lease=await this.provider.resolve(tenantId);
    if(lease.tenantId!==tenantId)throw new TenantDatabaseMismatchError();
    return new PgCrmRepository(lease);
  }
}
