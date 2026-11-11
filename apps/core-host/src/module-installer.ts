import {createHash} from "node:crypto";
import type {Pool, PoolClient} from "pg";
import {
  AccessDeniedError, ModuleRegistry, type ModuleDefinition,
} from "@syndes/core-kernel";
import {PgModuleCatalog} from "./module-catalog.js";
import {expectedTenantDatabase} from "./tenant-database.js";
import {tenantUUID} from "./adapters.js";

const VERSION=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ID=/^[a-z][a-z0-9_]*$/;
const MIGRATION=/^\d{3}_[a-z0-9_]+$/;
const HASH=/^[0-9a-f]{64}$/;
const IMAGE=/^sha256:[0-9a-f]{64}$/;
const sha256=(body:string)=>createHash("sha256").update(body,"utf8").digest("hex");
const deny=():never=>{throw new AccessDeniedError()};

export type TrustedMigration=Readonly<{
  id:string; version:string; sql:string; checksum:string;
  /** Explicit postconditions, qualified by the module-owned schema. */
  expectedRelations:readonly string[];
}>;
/** Populated only by a trusted, compiled release manifest in operator code.
 * Never construct this object from HTTP/tenant/Manager input.
 */
export type TrustedModuleRelease=Readonly<{
  id:string; version:string; schema:string; dependencies:readonly string[];
  imageDigest:string; migrations:readonly TrustedMigration[];
}>;
export type MigrationPlan=Readonly<{
  tenantId:string; moduleId:string; databaseName:string; schema:string;
  version:string; imageDigest:string; receipt:string;
  migrations:readonly Readonly<{id:string;status:"pending"|"applied";checksum:string}>[];
}>;
export type InstallerVerification=Readonly<{
  tenantId:string; moduleId:string; verified:true; receipt:string;
  imageDigest:string; version:string;
}>;
export type InstallAttestation=Readonly<{
  tenantId:string; moduleId:string; version:string; receipt:string;
  requestId:string; actorId:string; reason:string;
}>;
export interface TrustedInstallAttestor {
  /** Must use a separately authenticated installer role, NEVER Host runtime. */
  attestInstallation(request:InstallAttestation):Promise<void>;
}
type PoolProvider=(tenantId:string)=>Promise<Pool>;
type Control=Pick<Pool,"query">;
type ControlRow=Readonly<{
  database_name:string;role_name:string;
  state:string;target_version:string;installed_version:string|null;
  verification_digest:string|null;
}>;
type DependencyRow=Readonly<{
  dependency_id:string;entitlement_state:string|null;
  entitlement_current:boolean|null;install_state:string|null;
  installed_version:string|null;verification_digest:string|null;
}>;
type LedgerRow=Readonly<{module_id:string;migration_id:string;version:string;checksum:string;image_digest:string}>;
type Queryable=Pick<PoolClient,"query">;

/** Operator-only installation engine. No constructor is wired to Nest, HTTP,
 * worker dispatch or the runtime TenantPgProvider.
 * A separate privileged provider selects the canonical tenant DB.
 */
export class PgModuleInstaller {
  private readonly trusted=new Map<string,TrustedModuleRelease>();
  private readonly catalog:PgModuleCatalog;

  constructor(
    private readonly control:Control,
    private readonly resolveInstallerPool:PoolProvider,
    releases:readonly TrustedModuleRelease[],
    private readonly attestor?:TrustedInstallAttestor,
  ){
    const definitions:ModuleDefinition[]=[{id:"platform",version:"0.1.0"}];
    for(const item of releases){
      if(!item||!ID.test(item.id)||!ID.test(item.schema)||item.id!==item.schema ||
         !VERSION.test(item.version)||!IMAGE.test(item.imageDigest) ||
         this.trusted.has(item.id)||!Array.isArray(item.dependencies)||!Array.isArray(item.migrations)) {
        throw new Error("Invalid trusted installation release");
      }
      if(new Set(item.dependencies).size!==item.dependencies.length ||
         item.dependencies.some(dep=>!ID.test(dep)||dep===item.id)) {
        throw new Error("Invalid trusted installation dependencies");
      }
      if(!item.migrations.length)throw new Error("Release requires versioned migrations");
      const seen=new Set<string>();
      let prev="";
      for(const migration of item.migrations){
        if(!migration||!MIGRATION.test(migration.id)||migration.id<=prev||
           seen.has(migration.id)||migration.version!==item.version ||
           !migration.sql.trim()||!HASH.test(migration.checksum)||
           sha256(migration.sql)!==migration.checksum||
           !Array.isArray(migration.expectedRelations)||!migration.expectedRelations.length||
           migration.expectedRelations.some((name:string)=>!new RegExp("^"+item.schema+"\\.[a-z][a-z0-9_]*$").test(name))) {
          throw new Error("Invalid trusted migration/checksum");
        }
        // Manifest review is mandatory. Never execute migration from request.
        // Transactions exclude CREATE INDEX CONCURRENTLY; reject destructive
        // CASCADE and session identity changes as a conservative first gate.
        if(/\bDROP\b[\s\S]*?\bCASCADE\b/i.test(migration.sql)||
           /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i.test(migration.sql)||
           /\bSET\s+(?:ROLE|SESSION\s+AUTHORIZATION|SEARCH_PATH)\b/i.test(migration.sql)||
           /\\(?:connect|copy|include|i)\b/i.test(migration.sql)) {
          throw new Error("Disallowed migration operation");
        }
        seen.add(migration.id);
        prev=migration.id;
      }
      this.trusted.set(item.id,Object.freeze({
        ...item,
        dependencies:Object.freeze([...item.dependencies]),
        migrations:Object.freeze(item.migrations.map(m=>Object.freeze({
          ...m,expectedRelations:Object.freeze([...m.expectedRelations]),
        }))),
      }));
      definitions.push({id:item.id,version:item.version,schema:item.schema,
        dependencies:["platform",...item.dependencies]});
    }
    // Reject missing dependencies and cycles before even querying the Control DB.
    new ModuleRegistry(definitions).ordered();
    this.catalog=new PgModuleCatalog(control,definitions);
  }

  private release(id:string):TrustedModuleRelease {
    const item=this.trusted.get(id);
    if(!item)deny();
    return item!;
  }
  private receipt(item:TrustedModuleRelease):string {
    return sha256(JSON.stringify({
      moduleId:item.id,version:item.version,schema:item.schema,
      imageDigest:item.imageDigest,
      migrations:item.migrations.map(m=>({id:m.id,version:m.version,checksum:m.checksum})),
    }));
  }
  private async gate(tenantId:string,item:TrustedModuleRelease):Promise<ControlRow>{
    if(!tenantUUID(tenantId))deny();
    const available=await this.catalog.listAvailableForTenant(tenantId);
    if(!available.some(m=>m.id===item.id&&m.version===item.version&&m.schema===item.schema))deny();
    const r=await this.control.query<ControlRow>([
      "SELECT t.database_name,t.role_name,i.state,i.target_version,i.installed_version,i.verification_digest",
      "FROM public.tenant_registry t",
      "JOIN public.tenant_module_entitlements e ON e.tenant_id=t.tenant_id",
      "JOIN public.tenant_module_installs i ON i.tenant_id=e.tenant_id AND i.module_id=e.module_id",
      "WHERE t.tenant_id=$1::uuid AND t.state='active' AND e.module_id=$2",
      "AND e.state='granted' AND (e.valid_until IS NULL OR e.valid_until>clock_timestamp())",
      "AND i.state IN ('requested','installed')",
    ].join(" "),[tenantId,item.id]);
    const row=r.rows[0];
    const expected=expectedTenantDatabase(tenantId);
    if(!row||row.database_name!==expected.database_name||
       row.role_name!==expected.role_name||row.target_version!==item.version||
       (row.state==="installed" &&
        (row.installed_version!==item.version||row.verification_digest!==this.receipt(item))))deny();
    return row;
  }

  private async identity(db:Queryable,tenantId:string):Promise<void>{
    const r=await db.query<{name:string}>("SELECT current_database() AS name");
    if(r.rows[0]?.name!==expectedTenantDatabase(tenantId).database_name)deny();
  }
  private async ledger(db:Queryable):Promise<readonly LedgerRow[]>{
    const exists=await db.query<{exists:boolean}>(
      "SELECT to_regclass('_syndes.module_migrations') IS NOT NULL AS exists");
    if(exists.rows[0]?.exists!==true)deny(); // ledger bootstrap requires explicit operator privilege
    const rows=await db.query<LedgerRow>([
      "SELECT module_id,migration_id,version,checksum,image_digest",
      "FROM _syndes.module_migrations ORDER BY module_id,migration_id",
    ].join(" "));
    return rows.rows;
  }
  private async dependencies(db:Queryable,tenantId:string,item:TrustedModuleRelease,
                             ledger:readonly LedgerRow[]):Promise<void>{
    const rows=await this.control.query<DependencyRow>([
      "SELECT d.dependency_id,e.state AS entitlement_state,",
      "(e.state='granted' AND (e.valid_until IS NULL OR e.valid_until>clock_timestamp())) AS entitlement_current,",
      "i.state AS install_state,i.installed_version,i.verification_digest",
      "FROM public.module_catalog_dependencies d",
      "LEFT JOIN public.tenant_module_entitlements e",
      "ON e.tenant_id=$1::uuid AND e.module_id=d.dependency_id",
      "LEFT JOIN public.tenant_module_installs i",
      "ON i.tenant_id=$1::uuid AND i.module_id=d.dependency_id",
      "WHERE d.module_id=$2 AND d.version=$3",
      "ORDER BY d.dependency_id",
    ].join(" "),[tenantId,item.id,item.version]);
    const required=[...item.dependencies].sort();
    if(rows.rows.length!==required.length||
       rows.rows.some((row,i)=>row.dependency_id!==required[i]))deny();
    for(const row of rows.rows){
      const dep=this.release(row.dependency_id);
      if(row.entitlement_state!=="granted"||row.entitlement_current!==true||
         row.install_state!=="installed"||row.installed_version!==dep.version||
         row.verification_digest!==this.receipt(dep))deny();
      this.matchLedger(dep,ledger,true);
      const ns=await db.query<{exists:boolean}>("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) AS exists",[dep.schema]);
      if(ns.rows[0]?.exists!==true)deny();
      for(const migration of dep.migrations)for(const relation of migration.expectedRelations){
        const r=await db.query<{exists:boolean}>("SELECT to_regclass($1) IS NOT NULL AS exists",[relation]);
        if(r.rows[0]?.exists!==true)deny();
      }
    }
  }
  private matchLedger(item:TrustedModuleRelease,all:readonly LedgerRow[],
                      complete:boolean):readonly Readonly<{id:string;status:"pending"|"applied";checksum:string}>[]{
    const actual=all.filter(x=>x.module_id===item.id);
    if(actual.some(x=>!item.migrations.some(m=>m.id===x.migration_id)))deny();
    const statuses=item.migrations.map(m=>{
      const found=actual.find(x=>x.migration_id===m.id);
      if(found&&(found.version!==m.version||found.checksum!==m.checksum||
                  found.image_digest!==item.imageDigest))deny();
      if(complete&&!found)deny();
      return Object.freeze({id:m.id,status:found?"applied" as const:"pending" as const,checksum:m.checksum});
    });
    return Object.freeze(statuses);
  }
  private async planOn(db:Queryable,tenantId:string,item:TrustedModuleRelease):Promise<MigrationPlan>{
    await this.identity(db,tenantId);
    const ledger=await this.ledger(db);
    await this.dependencies(db,tenantId,item,ledger);
    return Object.freeze({
      tenantId,moduleId:item.id,databaseName:expectedTenantDatabase(tenantId).database_name,
      schema:item.schema,version:item.version,imageDigest:item.imageDigest,receipt:this.receipt(item),
      migrations:this.matchLedger(item,ledger,false),
    });
  }

  /** Read-only and repeatable. Never creates schema, tables, ledger or state. */
  async plan(tenantId:string,moduleId:string):Promise<MigrationPlan>{
    const item=this.release(moduleId);
    await this.gate(tenantId,item);
    const db=await this.resolveInstallerPool(tenantId);
    return this.planOn(db,tenantId,item);
  }

  /** Atomic tenant migration. Post-verify attestation is a separate Control DB
   * step: if it fails, a retry observes the committed ledger and re-attests.
   */
  async apply(tenantId:string,moduleId:string,
              attestation?:Omit<InstallAttestation,"tenantId"|"moduleId"|"version"|"receipt">):
    Promise<Readonly<{plan:MigrationPlan;verified:InstallerVerification;controlState:"installed"|"requested"}>> {
    const item=this.release(moduleId);
    await this.gate(tenantId,item);
    const db=await this.resolveInstallerPool(tenantId);
    const client=await db.connect();
    let committed=false;
    try{
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("SET LOCAL statement_timeout='20s'");
      await client.query("SET LOCAL search_path=pg_catalog");
      // Serialize all installers for this tenant/module inside the target DB.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        ["syndes/module-installer/"+moduleId]);
      const plan=await this.planOn(client,tenantId,item);
      await this.gate(tenantId,item); // detect revocation before any DDL
      for(const migration of item.migrations){
        if(plan.migrations.find(m=>m.id===migration.id)?.status==="applied")continue;
        // Module schema identifier comes from vetted, validated build manifest.
        await client.query('CREATE SCHEMA IF NOT EXISTS "'+item.schema+'"');
        await client.query(migration.sql);
        for(const relation of migration.expectedRelations){
          const check=await client.query<{exists:boolean}>("SELECT to_regclass($1) IS NOT NULL AS exists",[relation]);
          if(check.rows[0]?.exists!==true)deny();
        }
        await client.query([
          "INSERT INTO _syndes.module_migrations",
          "(module_id,migration_id,version,checksum,image_digest)",
          "VALUES($1,$2,$3,$4,$5)",
        ].join(" "),[item.id,migration.id,migration.version,migration.checksum,item.imageDigest]);
      }
      await this.gate(tenantId,item); // best-effort late check; cross-DB lock is impossible
      await client.query("COMMIT");
      committed=true;
    }finally{
      if(!committed)await client.query("ROLLBACK").catch(()=>{});
      client.release();
    }
    const verified=await this.verify(tenantId,moduleId);
    if(this.attestor&&attestation){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(attestation.requestId)||!attestation.actorId.trim()||!attestation.reason.trim())deny();
      await this.attestor.attestInstallation({
        ...attestation,tenantId,moduleId,version:item.version,receipt:verified.receipt,
      });
    }
    const current=await this.gate(tenantId,item);
    return Object.freeze({
      plan:await this.plan(tenantId,moduleId),verified,
      controlState:current.state==="installed"?"installed":"requested",
    });
  }

  /** Read-only: confirms physical SQL ledger checksum and explicit objects.
   * It does NOT replace Keycloak, entitlement, OpenFGA or Host runtime checks.
   */
  async verify(tenantId:string,moduleId:string):Promise<InstallerVerification>{
    const item=this.release(moduleId);
    await this.gate(tenantId,item);
    const db=await this.resolveInstallerPool(tenantId);
    await this.identity(db,tenantId);
    const ledger=await this.ledger(db);
    await this.dependencies(db,tenantId,item,ledger);
    this.matchLedger(item,ledger,true);
    const exists=await db.query<{found:boolean}>(
      "SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname=$1) AS found",
      [item.schema]);
    if(exists.rows[0]?.found!==true)deny();
    for(const migration of item.migrations)for(const relation of migration.expectedRelations){
      const r=await db.query<{found:boolean}>("SELECT to_regclass($1) IS NOT NULL AS found",[relation]);
      if(r.rows[0]?.found!==true)deny();
    }
    return Object.freeze({
      tenantId,moduleId,verified:true,version:item.version,
      imageDigest:item.imageDigest,receipt:this.receipt(item),
    });
  }
}

/** Only a preapproved installer identity may call this adapter.
 * It is intentionally not a Nest provider or an HTTP handler.
 */
export class PgControlInstallAttestor implements TrustedInstallAttestor {
  constructor(private readonly db:Pick<Pool,"query">){}
  async attestInstallation(request:InstallAttestation):Promise<void>{
    if(!tenantUUID(request.tenantId)||!ID.test(request.moduleId)||
       !VERSION.test(request.version)||!HASH.test(request.receipt))deny();
    const r=await this.db.query<{result:string}>(
      "SELECT public.attest_tenant_module_install($1::uuid,$2,$3,$4,$5::uuid,$6,$7) AS result",
      [request.tenantId,request.moduleId,request.version,request.receipt,
       request.requestId,request.actorId,request.reason]);
    if(r.rows[0]?.result!=="installed")deny();
  }
}
