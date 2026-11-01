import assert from "node:assert/strict";
import pg from "../../../apps/core-host/node_modules/pg/lib/index.js";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {CrmService,CrmExtras,crmModule,PgCrmRepository,PgCrmExtras} from "../dist/index.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077",B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const suffix=t=>t.replaceAll("-","");
const pool=t=>new pg.Pool({
  host:"127.0.0.1",port:54329,database:"syndes_tenant_"+suffix(t),
  user:"syndes_t_"+suffix(t),password:"ci-tenant-only-credential-123",max:2,
});
const pa=pool(A),pb=pool(B);
const alice={actor:{id:"alice",kind:"user"},tenantId:A};
const bob={actor:{id:"bob",kind:"user"},tenantId:B};
const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},crmModule],
  tenancy:{canAccessTenant:async({actor,tenantId})=>
    (actor.id==="alice"&&tenantId===A)||(actor.id==="bob"&&tenantId===B)},
  authorization:{canAccess:async({actor,tenantId,resource})=>
    (actor.id==="alice"?tenantId===A:tenantId===B)&&resource.startsWith("crm:")},
});
await kernel.start();
let selected=0;
const db=t=>{
  selected++;
  const p=t===A?pa:t===B?pb:null;
  if(!p)throw Error("Unexpected tenant");
  return {tenantId:t,query:async(sql,params)=>{
    const r=await p.query(sql,[...params]);
    return {rows:r.rows,rowCount:r.rowCount};
  }};
};
const crm=new CrmService(kernel,async t=>new PgCrmRepository(db(t)));
const ex=new CrmExtras(kernel,async t=>new PgCrmExtras(db(t)));
try {
  const org=await crm.createOrganization(alice,{legalName:"Empresa Alfa",taxId:"12345678000190"});
  const person=await crm.createPerson(alice,{name:"Carla Martins",email:"CARLA@EXAMPLE.COM",phone:"51999990000"});
  assert.equal(person.email,"carla@example.com");
  await crm.linkPerson(alice,person.id,org.id);
  const tag=await crm.createTag(alice,"Cliente VIP");
  await crm.tagPerson(alice,person.id,tag.id);
  await crm.createNote(alice,person.id,"Ligar na segunda-feira.");
  const notes=await crm.listNotes(alice,person.id);
  assert.equal(notes[0].body,"Ligar na segunda-feira.");
  const timeline=await crm.listTimeline(alice,person.id);
  assert.ok(timeline.length>=4);
  assert.ok((await crm.listPeople(alice,"VIP",25)).some(p=>p.id===person.id));
  assert.ok((await crm.listPeople(alice,"Empresa Alfa",25)).some(p=>p.id===person.id));
  const duplicate=await ex.possibleDuplicates(alice,{email:"carla@example.com"});
  assert.equal(duplicate[0].id,person.id);
  const employee=await ex.createEmployee(alice,person.id,"Atendente");
  assert.equal(employee.personId,person.id);
  assert.equal((await ex.listEmployees(alice))[0].personId,person.id);
  const channel=await ex.linkChannel(alice,person.id,{channel:"whatsapp",externalId:"551199999999",displayName:"Push Name Externo"});
  assert.equal((await ex.listChannels(alice,person.id))[0].id,channel.id);
  assert.equal((await crm.getPerson(alice,person.id)).name,"Carla Martins","Channel name cannot overwrite CRM name");

  const imported=await ex.importCsv(alice,'name,email,phone\r\n"Júlia Ribeiro",julia@example.com,51998887766\r\n');
  assert.equal(imported.imported,1);
  const csv=await ex.exportCsv(alice);
  assert.match(csv,/Júlia Ribeiro/);
  assert.match(csv,/Carla Martins/);
  const other=await crm.createPerson(bob,{name:"Empresa B, Registro Próprio"});
  assert.equal((await crm.listPeople(bob)).length,1);
  assert.equal(await crm.getPerson(alice,other.id),null);
  assert.equal(await crm.getPerson(bob,person.id),null);
  assert.equal((await ex.listEmployees(bob)).length,0);
  assert.deepEqual(await ex.listChannels(bob,person.id),[]);
  const prior=selected;
  await assert.rejects(crm.listPeople({...alice,tenantId:B}),AccessDeniedError);
  await assert.rejects(ex.exportCsv({...alice,tenantId:B}),AccessDeniedError);
  assert.equal(selected,prior,"Cross-tenant request may not resolve any database");

  await assert.rejects(async()=>{
    const stolen=new pg.Pool({host:"127.0.0.1",port:54329,
      user:"syndes_t_"+suffix(B),password:"ci-tenant-only-credential-123",
      database:"syndes_tenant_"+suffix(A),connectionTimeoutMillis:1500});
    try{await stolen.query("SELECT 1")}finally{await stolen.end()}
  },/permission denied|not allowed/i,"Tenant B Postgres role must not connect to A database");

  assert.equal(await crm.archivePerson(alice,person.id),true);
  assert.equal(await crm.getPerson(alice,person.id),null);
  assert.equal(await ex.archiveOrganization(alice,org.id),true);
  const audit=await pa.query("SELECT count(*)::int AS total FROM crm_audit WHERE tenant_id=$1",[A]);
  assert.ok(audit.rows[0].total>=10);
  console.log("CRM full acceptance: two physically isolated tenant DBs, CRUD, FGA/tenancy guards, notes, tags, channels, employees, duplicate detection, CSV, audit and archive — PASS");
}finally{
 await Promise.all([pa.end(),pb.end()]);
}
