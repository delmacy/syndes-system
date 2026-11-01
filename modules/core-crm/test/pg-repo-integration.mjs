import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "../../../apps/core-host/node_modules/pg/lib/index.js";
import { PgCrmRepository,PgCrmExtras,parseContactsCsv,contactsToCsv } from "../dist/index.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const pool=new pg.Pool({
  connectionString:"postgres://postgres:ci-only-not-production-123@127.0.0.1:54329/postgres",
  max:2,
});
const db=tenantId=>({
  tenantId,
  query:async(sql,values)=>pool.query(sql,[...values]),
});
try {
  const a=new PgCrmRepository(db(A));
  const b=new PgCrmRepository(db(B));
  const ex=new PgCrmExtras(db(A));
  const bx=new PgCrmExtras(db(B));
  const organization=await a.createOrganization(A,"alice",randomUUID(),{
    legalName:"Acme Serviços",tradeName:null,taxId:"12345678000190"
  });
  const created=await a.createPerson(A,"alice",randomUUID(),{
    name:"Ana Costa",email:"ana@example.com",phone:"+5551999990000"
  });
  assert.equal((await a.getPerson(A,created.id)).id,created.id);
  assert.equal(await b.getPerson(B,created.id),null,"cross-tenant read");
  assert.equal((await a.listPeople(A,"Ana",10)).length,1);
  assert.equal((await b.listPeople(B,"Ana",10)).length,0);
  assert.equal((await a.listPeople(A,"\\\\%",10)).length,0,
    "wildcard search should be escaped by the service layer");
  const link=await a.linkPerson(A,"alice",created.id,organization.id);
  assert.deepEqual(link,{tenantId:A,personId:created.id,organizationId:organization.id});
  const tag=await a.createTag(A,"alice",randomUUID(),"VIP");
  assert.equal(tag.label,"VIP");
  await assert.rejects(a.createTag(A,"alice",randomUUID(),"VIP"),/duplicate key/);
  const tagged=await a.tagPerson(A,"alice",created.id,tag.id);
  assert.equal(tagged.tagId,tag.id);
  await assert.rejects(b.tagPerson(B,"bob",created.id,tag.id));
  assert.equal((await a.listPeople(A,"VIP",10)).length,1);
  assert.equal((await a.listPeople(A,"Acme",10)).length,1);
  assert.equal((await a.listPeople(A,"12345678000190",10)).length,1);
  const note=await a.createNote(A,"alice",randomUUID(),created.id,"Cliente pediu retorno");
  assert.equal(note.personId,created.id);
  assert.equal((await a.listTimeline(A,created.id,10))[0].action,"noted");
  assert.deepEqual(await b.listTimeline(B,created.id,10),[]);

  await assert.rejects(b.linkPerson(B,"bob",created.id,organization.id));
  assert.equal(await b.archivePerson(B,"bob",created.id),false);
  assert.equal(await a.archivePerson(A,"alice",created.id),true);
  assert.equal(await a.getPerson(A,created.id),null);
  assert.equal(await a.archivePerson(A,"alice",created.id),false);
  const second=await a.createPerson(A,"alice",randomUUID(),{name:"Carlos",email:"carlos@example.com",phone:null});
  const updated=await ex.updatePerson(A,"alice",second.id,{name:"Carlos Silva",email:second.email,phone:null});
  assert.equal(updated.name,"Carlos Silva");
  assert.equal(await bx.updatePerson(B,"bob",second.id,{name:"Wrong",email:null,phone:null}),null);
  assert.equal((await ex.getOrganization(A,organization.id)).legalName,"Acme Serviços");
  assert.equal((await ex.listOrganizations(A,"Acme",10)).length,1);
  const changedOrg=await ex.updateOrganization(A,"alice",organization.id,
    {legalName:"Acme Serviços Ltda",tradeName:"Acme",taxId:"12345678000190"});
  assert.equal(changedOrg.tradeName,"Acme");
  assert.equal((await ex.duplicates(A,"carlos@example.com",null,null)).length,1);
  assert.deepEqual(await bx.duplicates(B,"carlos@example.com",null,null),[]);
  const employee=await ex.createEmployee(A,"alice",randomUUID(),second.id,"Atendente");
  assert.equal(employee.jobTitle,"Atendente");
  await assert.rejects(bx.createEmployee(B,"bob",randomUUID(),second.id,"Invasor"));
  const channel=await ex.linkChannel(A,"alice",randomUUID(),second.id,"whatsapp","551199998888","Nome externo");
  assert.equal(channel.personId,second.id);
  assert.equal((await a.getPerson(A,second.id)).name,"Carlos Silva","Channel push name cannot overwrite CRM name");
  await assert.rejects(bx.linkChannel(B,"bob",randomUUID(),second.id,"whatsapp","other",null));
  const imported=parseContactsCsv('name,email,phone\\n"Pessoa, Importada",importada@example.com,551199991111\\n');
  assert.equal(await ex.importPeople(A,"alice",imported.map(x=>({...x,id:randomUUID()}))),1);
  const exported=contactsToCsv(await ex.listExportPeople(A,1000));
  assert.match(exported,/Pessoa, Importada/);
  assert.equal(await ex.archiveOrganization(A,"alice",organization.id),true);
  assert.equal(await ex.getOrganization(A,organization.id),null);
  assert.equal(await ex.archiveOrganization(A,"alice",organization.id),false);
  const audit=await pool.query(
    "SELECT action, actor_id FROM crm_audit WHERE tenant_id=$1 ORDER BY id", [A]);
  assert.deepEqual(audit.rows.map(x=>x.action),[
    "created","created","linked_organization","created","tagged","noted","archived",
    "created","updated","updated","employee_created","channel_linked","imported","archived"
  ]);
  assert.ok(audit.rows.every(x=>x.actor_id==="alice"));
  console.log("CRM real PostgreSQL CRUD, audit and cross-tenant predicates: PASS");
} finally {
  await pool.end();
}
