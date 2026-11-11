import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {TenantPgProvider,expectedTenantDatabase} from "../dist/tenant-database.js";
import {PgModuleCatalog} from "../dist/module-catalog.js";
import {PgModuleLifecycle} from "../dist/module-lifecycle.js";
import {PgEffectiveModuleAccess} from "../dist/module-effective-access.js";
import {OpenFgaServiceEventGrant,fgaEventDeliveryObject}
 from "../dist/platform-event-service-grant.js";
import {composeTenantEventWorker} from "../dist/platform-event-worker-composition.js";
import {TenantEventWorkerBatch} from "../dist/platform-event-worker-batch.js";

const pgUrl=process.env.SYNDES_EVENTS_PG_URL;
const fgaUrl=process.env.SYNDES_EVENTS_FGA_URL;
const pgFixture="syndes-event-staging-pg17-20261111";
const fgaFixture="syndes-events-fga-disposable-20261111";
const safe=(()=>{
 if(!pgUrl||!fgaUrl||
  process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY"||
  process.env.SYNDES_EVENTS_FGA_DISPOSABLE!=="EVENTS_FGA_IN_MEMORY_ONLY")return false;
 try{
  const u=new URL(pgUrl);
  return u.protocol==="postgresql:"&&u.hostname==="127.0.0.1"&&
   u.pathname==="/postgres"&&u.username==="postgres"&&
   u.port==="32770"&&u.password.startsWith("ci-only-disposable-")&&
   fgaUrl==="http://127.0.0.1:18090";
 }catch{return false}
})();
const sql=path=>readFile(new URL(path,import.meta.url),"utf8");
const dsn=name=>{const u=new URL(pgUrl);u.pathname="/"+name;return u.toString()};
const tenantMigrations=[
 "../../../modules/organizations/sql/001_account_hierarchy.sql",
 "../../../modules/organizations/sql/002_legacy_single_context_gate.sql",
 "../../../modules/core-crm/sql/001_crm_foundation.sql",
 "../../../modules/core-crm/sql/002_crm_tags_notes.sql",
 "../../../modules/core-crm/sql/003_crm_employees_channels.sql",
 "../../../modules/inbox/sql/001_inbox_foundation.sql",
 "../../../modules/whatsapp/sql/001_whatsapp_accounts.sql",
 "../../../modules/whatsapp/sql/002_whatsapp_inbound.sql",
 "../../../modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql",
 "../../../modules/whatsapp/sql/004_whatsapp_conversation_phone.sql",
 "../../../modules/whatsapp/sql/005_whatsapp_history.sql",
 "../../../modules/whatsapp/sql/008_whatsapp_projection_owner.sql",
 "../../../modules/organizations/sql/003_legacy_ownership.sql",
 "../../../modules/organizations/sql/004_whatsapp_route_owner_guard.sql",
 "../../../modules/organizations/sql/005_scoped_relationship_integrity.sql",
 "../sql/001_platform_events.sql",
 "../sql/002_event_type_version_consistency.sql",
];
const controlMigrations=[
 "../../../infra/postgres/bootstrap/control.schema",
 "../../../infra/postgres/bootstrap/control-module-catalog.schema",
 "../../../infra/postgres/bootstrap/control-module-lifecycle.schema",
 "../../../infra/postgres/bootstrap/control-module-attestation.schema",
 "../../../infra/postgres/bootstrap/control-module-activation.schema",
 "../../../infra/postgres/bootstrap/control-module-manager-readonly.schema",
 "../../../infra/postgres/bootstrap/control-module-events.schema",
];
const readCount=async(pool,table)=>Number((await pool.query(
 "SELECT count(*)::int AS n FROM "+table)).rows[0].n);

test("Disposable staging: real Control PG17, OpenFGA service grant and WA -> Inbox -> CRM",
 {skip:!safe},async t=>{
 const checkFixture=(name,image,label,port,binding)=>{
  const c=JSON.parse(execFileSync("docker",["inspect",name],{encoding:"utf8",timeout:5000}))[0];
  assert.equal(c.Config.Image,image);
  assert.equal(c.Config.Labels["syndes.disposable"],label);
  assert.ok(c.NetworkSettings.Ports[port]?.some(x=>
   x.HostIp==="127.0.0.1"&&x.HostPort===binding));
 };
 checkFixture(pgFixture,"postgres:17-alpine","event-staging-pg17","5432/tcp","32770");
 checkFixture(fgaFixture,"openfga/openfga:v1.22.1","event-staging-fga","8080/tcp","18090");
 const api=async(method,path,payload)=>{
  const response=await fetch(fgaUrl+path,{
   method,headers:{"Content-Type":"application/json"},
   body:payload===undefined?undefined:JSON.stringify(payload),
   signal:AbortSignal.timeout(5000),
  });
  if(!response.ok)throw Error("Disposable OpenFGA call "+method+" failed: "+response.status);
  return response.json();
 };
 const admin=new pg.Client({connectionString:pgUrl});await admin.connect();
 const version=(await admin.query("SELECT current_setting('server_version_num')::int AS n")).rows[0].n;
 assert.ok(version>=170000&&version<180000);
 const tenantId=randomUUID(),orgId=randomUUID(),workspaceId=randomUUID(),
  accountId=randomUUID(),personId=randomUUID();
 const tenantDb=expectedTenantDatabase(tenantId).database_name;
 // The Control migration intentionally requires this exact database name.
 // The Docker name/label/localhost-port gates above prove it is disposable.
 const controlDb="syndes_control";
 let control,tenant,provider;
 const created=[];
 try{
  for(const db of [controlDb,tenantDb]){
   await admin.query('CREATE DATABASE "'+db+'"');
   created.push(db);
  }
  control=new pg.Pool({connectionString:dsn(controlDb),max:5});
  tenant=new pg.Pool({connectionString:dsn(tenantDb),max:8});
  await control.query(`DO $role$ BEGIN
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_core')
   THEN CREATE ROLE syndes_core NOLOGIN; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_master_api')
   THEN CREATE ROLE syndes_master_api NOLOGIN NOINHERIT; END IF;
  END $role$;`);
  for(const path of controlMigrations)await control.query(await sql(path));
  for(const path of tenantMigrations)await tenant.query(await sql(path));
  const suffix=tenantId.replaceAll("-","");
  await control.query(`
   INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
   VALUES($1,$2,$3,'active')
  `,[tenantId,tenantDb,"syndes_t_"+suffix]);
  await control.query(`
   INSERT INTO module_catalog(module_id,schema_name) VALUES('crm','crm'),('inbox','inbox');
   INSERT INTO module_catalog_versions(module_id,version,approved,approved_at,approved_by)
   VALUES('crm','0.1.0',true,clock_timestamp(),'fixture'),
         ('inbox','0.1.0',true,clock_timestamp(),'fixture');
   INSERT INTO module_catalog_dependencies(module_id,version,dependency_id)
   VALUES('inbox','0.1.0','crm');
  `);
  for(const moduleId of ["crm","inbox"]){
   await control.query(`
    INSERT INTO tenant_module_entitlements(tenant_id,module_id,state)
    VALUES($1,$2,'granted')
   `,[tenantId,moduleId]);
   await control.query(`
    INSERT INTO tenant_module_installs(tenant_id,module_id,target_version,
     state,installed_version,verification_digest,verified_at)
    VALUES($1,$2,'0.1.0','enabled','0.1.0',$3,clock_timestamp())
   `,[tenantId,moduleId,"a".repeat(64)]);
  }
  await tenant.query(
   "INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Staging demo',true)",
   [tenantId,orgId]);
  await tenant.query(
   "INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Staging','staging',true)",
   [tenantId,workspaceId,orgId]);
  await tenant.query(`
   INSERT INTO whatsapp_accounts(tenant_id,id,display_name,platform_organization_id,service_enabled)
    VALUES($1,$2,'Disposable WhatsApp',$3,true)
  `,[tenantId,accountId,orgId]);
  const phone="+5511988877766",jid="5511988877766@s.whatsapp.net";
  await tenant.query(
   "INSERT INTO crm_people(tenant_id,id,name,phone,platform_organization_id) VALUES($1,$2,'Known synthetic person',$3,$4)",
   [tenantId,personId,phone,orgId]);
  await tenant.query(
   "INSERT INTO crm_channel_identities(tenant_id,id,person_id,channel,external_id,platform_organization_id) VALUES($1,$2,$3,'whatsapp',$4,$5)",
   [tenantId,randomUUID(),personId,jid,orgId]);

  provider=new TenantPgProvider({db:{query:async(_query,args)=>({
   rows:[expectedTenantDatabase(args[0])],rowCount:1,
  })}});
  provider.pools.set(tenantId,{pool:tenant,last:Date.now()});
  const trusted=[
   {id:"crm",version:"0.1.0",schema:"crm",dependencies:[]},
   {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["crm"]},
  ];
  const moduleAccess=new PgEffectiveModuleAccess(
   new PgModuleLifecycle(control,new PgModuleCatalog(control,trusted)));
  const store=await api("POST","/stores",{name:"events-staging-"+randomUUID()});
  const model=JSON.parse(await sql("../../../infra/security-access/fga-model.json"));
  const modelVersion=await api("POST","/stores/"+store.id+"/authorization-models",model);
  assert.ok(modelVersion.authorization_model_id);
  const principalId="syndes-stage-service";
  const stage=composeTenantEventWorker({
   databases:provider,modules:moduleAccess,
   serviceGrants:new OpenFgaServiceEventGrant(
    fgaUrl,store.id,"disposable-token",principalId),
   principalId,
  });
  const scope={tenantId,organizationId:orgId,workspaceId,moduleId:"",consumerId:"",eventType:""};
  const tuples=[
   ["inbox","inbox.message-received-v2","whatsapp.message.received.v2"],
   ["crm","crm.resolve-person","inbox.participant.observed.v1"],
   ["inbox","inbox.crm-person-link","crm.person.resolved.v1"],
  ].map(([moduleId,consumerId,eventType])=>({
   user:"service:"+principalId,relation:"processor",
   object:fgaEventDeliveryObject({...scope,moduleId,consumerId,eventType}),
  }));
  const message=extId=>({
   version:"1",type:"whatsapp.message.received",tenantId,accountId,
   message:{accountId,externalMessageId:extId,senderExternalId:jid,
    chatExternalId:jid,senderPhone:phone,body:"Disposable staging text only",
    occurredAt:"2026-11-11T12:00:00.000Z",source:"live",isGroup:false,fromMe:false},
  });
  const pump=new TenantEventWorkerBatch(stage.dispatcher);

  await t.test("without any FGA grant the worker cannot process business effects",async()=>{
   // Use an admission check before routing, to avoid knowingly dead-lettering
   // a synthetic event without a grant.
   const allowed=await moduleAccess.canExecuteModule({
    actor:{kind:"service",id:principalId},tenantId,moduleId:"crm"});
   assert.equal(allowed,true);
   const decision=await api("POST","/stores/"+store.id+"/check",{
    tuple_key:{user:"service:"+principalId,relation:"can_process",object:tuples[0].object},
   });
   assert.equal(decision.allowed,false);
   assert.equal(await readCount(tenant,"inbox_messages"),0);
  });
  await api("POST","/stores/"+store.id+"/write",{writes:{tuple_keys:tuples}});

  await t.test("disabled CRM dependency suspends without dropping WhatsApp/Inbox",async()=>{
   const result=await stage.bridge.persist(tenantId,message(randomUUID()));
   assert.deepEqual(result,{accepted:true,duplicate:false});
   await control.query(
    "UPDATE tenant_module_installs SET state='installed' WHERE tenant_id=$1 AND module_id='crm'",
    [tenantId]);
   const first=await pump.run(tenantId,8);
   assert.ok(first.suspended>=1);
   assert.equal(first.delivered,0);
   assert.equal(await readCount(tenant,"inbox_messages"),0);
   const delivery=(await tenant.query(
    "SELECT state,attempts FROM platform_events.event_deliveries"
   )).rows;
   assert.ok(delivery.every(x=>x.state==="suspended"&&x.attempts===0));
  });
  await t.test("reenabled dependencies recover and link the known CRM person",async()=>{
   await control.query(
    "UPDATE tenant_module_installs SET state='enabled' WHERE tenant_id=$1 AND module_id='crm'",
    [tenantId]);
   await tenant.query(
    "UPDATE platform_events.event_deliveries SET next_attempt_at=clock_timestamp() WHERE state='suspended'");
   let delivered=0;
   for(let i=0;i<5;i++){
    const step=await pump.run(tenantId,12);
    delivered+=step.delivered;
    if(delivered===3)break;
   }
   assert.equal(delivered,3);
   assert.equal(await readCount(tenant,"inbox_messages"),1);
   assert.equal(await readCount(tenant,"platform_events.consumer_inbox"),3);
   assert.equal(await readCount(tenant,"crm_people"),1);
   const link=(await tenant.query("SELECT crm_person_id::text FROM inbox_conversations")).rows[0];
   assert.equal(link.crm_person_id,personId);
   const body=(await tenant.query(
    "SELECT payload::text AS body FROM platform_events.outbox_events"
   )).rows.map(x=>x.body).join(" ");
   assert.equal(body.includes("Disposable staging text only"),false);
   assert.equal(body.includes(jid),false);
  });
  await t.test("repeating the WhatsApp input produces no new event or business effect",async()=>{
   const raw=(await tenant.query(
    "SELECT payload FROM whatsapp_inbound_events LIMIT 1"
   )).rows[0].payload;
   assert.deepEqual(await stage.bridge.persist(tenantId,raw),{accepted:true,duplicate:true});
   assert.equal(await readCount(tenant,"inbox_messages"),1);
   assert.equal(await readCount(tenant,"platform_events.outbox_events"),3);
  });
  await t.test("revoking exact OpenFGA grant blocks future event effects",async()=>{
   await api("POST","/stores/"+store.id+"/write",{deletes:{tuple_keys:[tuples[0]]}});
   await stage.bridge.persist(tenantId,message(randomUUID()));
   const denied=await pump.run(tenantId,4);
   assert.ok(denied.dead>=1);
   assert.equal(await readCount(tenant,"inbox_messages"),1);
   assert.equal(await readCount(tenant,"crm_people"),1);
   const dead=(await tenant.query(
    "SELECT state,last_error_class FROM platform_events.event_deliveries WHERE state='dead'"
   )).rows;
   assert.ok(dead.some(x=>x.last_error_class==="unauthorized"));
  });
 }finally{
  if(provider)await provider.onModuleDestroy().catch(()=>{});
  if(control)await control.end().catch(()=>{});
  if(tenant&&!provider)await tenant.end().catch(()=>{});
  for(const name of created){
   await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",[name]);
   await admin.query('DROP DATABASE "'+name+'"');
  }
  await admin.end();
 }
});
