import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";

const url=process.env.SYNDES_ORG_TEST_PG_URL;
const tenant="11111111-1111-4111-8111-111111111111";
const file=async rel=>readFile(new URL(rel,import.meta.url),"utf8");
const stripTransaction=s=>s.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");

test("org-aware CRM SQL isolates two companies inside ONE tenant across CRUD, joins, search, CSV and employees",{
 skip:!url&&"requires disposable PostgreSQL"
},async()=>{
 const {PgCrmRepository,PgCrmExtras}=await import("../../core-crm/dist/index.js");
 const c=new pg.Client({connectionString:url});
 await c.connect();
 const schema="crm_org_"+randomUUID().replaceAll("-","").slice(0,15);
 const oa=randomUUID(),ob=randomUUID(),wa=randomUUID(),wb=randomUUID();
 try{
  await c.query("BEGIN");
  await c.query("CREATE SCHEMA "+schema);
  await c.query("SET LOCAL search_path TO "+schema);
  for(const path of [
   "../../core-crm/sql/001_crm_foundation.sql",
   "../../core-crm/sql/002_crm_tags_notes.sql",
   "../../core-crm/sql/003_crm_employees_channels.sql",
   "../../inbox/sql/001_inbox_foundation.sql",
   "../../whatsapp/sql/001_whatsapp_accounts.sql",
   "../../whatsapp/sql/002_whatsapp_inbound.sql",
   "../../whatsapp/sql/003_whatsapp_outbound_inbox.sql",
   "../sql/001_account_hierarchy.sql",
   "../sql/002_legacy_single_context_gate.sql",
   "../sql/003_legacy_ownership.sql",
  ])await c.query(stripTransaction(await file(path)));
  // ONLY in this disposable test: remove Stage A gate so two organizations
  // can test actual SQL row separation while the production gate stays intact.
  await c.query("DROP INDEX platform_legacy_single_organization");
  await c.query("DROP INDEX platform_legacy_single_workspace");
  await c.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Alpha',true),($1,$3,'Beta',false)",[tenant,oa,ob]);
  await c.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Alpha Ops','alpha',true),($1,$4,$5,'Beta Ops','beta',true)",[tenant,wa,oa,wb,ob]);
  const db={tenantId:tenant,query:async(sql,params)=>{
   const result=await c.query(sql,[...params]);
   return {rows:result.rows,rowCount:result.rowCount};
  }};
  const a=new PgCrmRepository(db,oa),b=new PgCrmRepository(db,ob);
  const ax=new PgCrmExtras(db,oa),bx=new PgCrmExtras(db,ob);
  const ac=await a.createOrganization(tenant,"alice",randomUUID(),{legalName:"Acme Alpha",tradeName:null,taxId:"11111111000111"});
  const bc=await b.createOrganization(tenant,"bob",randomUUID(),{legalName:"Beta Ltda",tradeName:null,taxId:"22222222000122"});
  const ap=await a.createPerson(tenant,"alice",randomUUID(),{name:"Ana Alpha",email:"ana@alpha.test",phone:"+5551999991111"});
  const bp=await b.createPerson(tenant,"bob",randomUUID(),{name:"Bia Beta",email:"bia@beta.test",phone:"+5551999992222"});
  const tt=await c.query("SELECT id,platform_organization_id FROM crm_people ORDER BY name");
  assert.deepEqual(new Map(tt.rows.map(r=>[r.id,r.platform_organization_id])),new Map([[ap.id,oa],[bp.id,ob]]));
  assert.equal((await a.getPerson(tenant,bp.id)),null,"Known foreign ID must not leak");
  assert.equal((await b.getPerson(tenant,ap.id)),null);
  assert.deepEqual((await a.listPeople(tenant,null,20)).map(p=>p.id),[ap.id]);
  assert.deepEqual((await b.listPeople(tenant,null,20)).map(p=>p.id),[bp.id]);
  assert.deepEqual((await a.listPeople(tenant,"Beta",20)).map(p=>p.id),[]);
  assert.deepEqual((await b.listPeople(tenant,"Alpha",20)).map(p=>p.id),[]);
  assert.deepEqual((await ax.listOrganizations(tenant,null,20)).map(p=>p.id),[ac.id]);
  assert.equal(await ax.getOrganization(tenant,bc.id),null);
  assert.equal(await bx.updateOrganization(tenant,"bob",ac.id,{legalName:"Taken",tradeName:null,taxId:null}),null);
  assert.equal(await ax.archiveOrganization(tenant,"alice",bc.id),false);
  assert.equal(await bx.updatePerson(tenant,"bob",ap.id,{name:"Stolen",email:null,phone:null}),null);
  assert.equal(await a.archivePerson(tenant,"alice",bp.id),false);
  await assert.rejects(a.linkPerson(tenant,"alice",ap.id,bc.id));
  await assert.rejects(b.linkPerson(tenant,"bob",ap.id,bc.id));
  await a.linkPerson(tenant,"alice",ap.id,ac.id);
  await b.linkPerson(tenant,"bob",bp.id,bc.id);
  assert.deepEqual((await ax.listPersonOrganizations(tenant,ap.id,25)).map(x=>x.id),[ac.id]);
  assert.deepEqual(await bx.listPersonOrganizations(tenant,ap.id,25),[]);
  const at=await a.createTag(tenant,"alice",randomUUID(),"alpha-only");
  const bt=await b.createTag(tenant,"bob",randomUUID(),"beta-only");
  await assert.rejects(a.tagPerson(tenant,"alice",ap.id,bt.id));
  await a.tagPerson(tenant,"alice",ap.id,at.id);
  await b.tagPerson(tenant,"bob",bp.id,bt.id);
  assert.deepEqual((await ax.listPersonTags(tenant,ap.id,25)).map(x=>x.id),[at.id]);
  assert.deepEqual(await bx.listPersonTags(tenant,ap.id,25),[]);
  assert.deepEqual((await ax.listTags(tenant,100)).map(x=>x.id),[at.id]);
  assert.deepEqual((await bx.listTags(tenant,100)).map(x=>x.id),[bt.id]);
  assert.deepEqual((await a.listPeople(tenant,"beta-only",20)).map(x=>x.id),[]);
  assert.deepEqual((await b.listPeople(tenant,"alpha-only",20)).map(x=>x.id),[]);
  assert.deepEqual((await a.listPeople(tenant,"Beta Ltda",20)).map(x=>x.id),[]);
  const an=await a.createNote(tenant,"alice",randomUUID(),ap.id,"Alpha confidential note");
  await assert.rejects(a.createNote(tenant,"alice",randomUUID(),bp.id,"cross"));
  assert.equal((await a.listNotes(tenant,ap.id,10))[0].id,an.id);
  assert.deepEqual(await b.listNotes(tenant,ap.id,10),[]);
  assert.deepEqual(await b.listTimeline(tenant,ap.id,50),[]);
  assert.equal((await a.listTimeline(tenant,ap.id,50)).length>0,true);
  const ae=await ax.createEmployee(tenant,"alice",randomUUID(),ap.id,"Alpha agent");
  await assert.rejects(ax.createEmployee(tenant,"alice",randomUUID(),bp.id,"Foreign"));
  assert.equal((await ax.listEmployees(tenant,100))[0].id,ae.id);
  assert.deepEqual(await bx.listEmployees(tenant,100),[]);
  assert.equal(await bx.getPersonEmployee(tenant,ap.id),null);
  const ach=await ax.linkChannel(tenant,"alice",randomUUID(),ap.id,"whatsapp","alpha@device",null);
  await assert.rejects(bx.linkChannel(tenant,"bob",randomUUID(),ap.id,"whatsapp","stolen@device",null));
  assert.equal((await ax.listChannels(tenant,ap.id,100))[0].id,ach.id);
  assert.deepEqual(await bx.listChannels(tenant,ap.id,100),[]);
  assert.deepEqual(await ax.duplicates(tenant,"bia@beta.test",null,null),[]);
  assert.equal((await bx.duplicates(tenant,"bia@beta.test",null,null)).length,1);
  const imported=await ax.importPeople(tenant,"alice",[
   {id:randomUUID(),name:"Alpha Imported",email:"imported@alpha.test",phone:null},
  ]);
  assert.equal(imported,1);
  const alphaExport=await ax.listExportPeople(tenant,1000);
  const betaExport=await bx.listExportPeople(tenant,1000);
  assert.ok(alphaExport.some(x=>x.name==="Alpha Imported"));
  assert.ok(!alphaExport.some(x=>x.name==="Bia Beta"));
  assert.deepEqual(betaExport.map(x=>x.id),[bp.id]);
  assert.equal(await ax.unlinkOrganization(tenant,"alice",ap.id,bc.id),false);
  assert.equal(await ax.unlinkTag(tenant,"alice",ap.id,bt.id),false);
  assert.equal(await bx.unlinkOrganization(tenant,"bob",ap.id,ac.id),false);
  assert.equal(await bx.unlinkTag(tenant,"bob",ap.id,at.id),false);
  assert.equal(await ax.unlinkTag(tenant,"alice",ap.id,at.id),true);
  assert.equal(await ax.unlinkOrganization(tenant,"alice",ap.id,ac.id),true);
  assert.equal(await bx.archiveOrganization(tenant,"bob",ac.id),false);
 }finally{
  await c.query("ROLLBACK");
  await c.end();
 }
});
