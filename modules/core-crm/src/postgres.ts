import type {
  CrmRepository, CreateOrganization, CreatePerson, Organization, Person,
  PersonOrganization, TrustedTenantDatabaseProvider, TenantDatabase,
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

  async createOrganization(tenantId:string,actorId:string,id:string,input:CreateOrganization):Promise<Organization>{
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
    const result=await this.db.query(
      "SELECT id,tenant_id,name,email,phone,archived_at FROM crm_people WHERE tenant_id=$1::uuid AND id=$2::uuid AND archived_at IS NULL",
      [tenantId,id]);
    return result.rows[0]?person(result.rows[0]):null;
  }

  async listPeople(tenantId:string,query:string|null,limit:number):Promise<readonly Person[]>{
    const result=await this.db.query(`
      SELECT id,tenant_id,name,email,phone,archived_at FROM crm_people
      WHERE tenant_id=$1::uuid AND archived_at IS NULL
      AND ($2::text IS NULL OR name ILIKE '%' || $2::text || '%' ESCAPE '\\'
         OR email ILIKE '%' || $2::text || '%' ESCAPE '\\'
         OR phone ILIKE '%' || $2::text || '%' ESCAPE '\\')
      ORDER BY name,id LIMIT $3`,[tenantId,query,limit]);
    return result.rows.map(person);
  }

  async archivePerson(tenantId:string,actorId:string,id:string):Promise<boolean>{
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
