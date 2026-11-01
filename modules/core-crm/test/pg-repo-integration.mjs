import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "../../../apps/core-host/node_modules/pg/lib/index.js";
import { PgCrmRepository } from "../dist/index.js";

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
  assert.equal((await a.listPeople(A,"%",10)).length,0,
    "wildcard search should be escaped by the service layer");
  const link=await a.linkPerson(A,"alice",created.id,organization.id);
  assert.deepEqual(link,{tenantId:A,personId:created.id,organizationId:organization.id});
  await assert.rejects(b.linkPerson(B,"bob",created.id,organization.id));
  assert.equal(await b.archivePerson(B,"bob",created.id),false);
  assert.equal(await a.archivePerson(A,"alice",created.id),true);
  assert.equal(await a.getPerson(A,created.id),null);
  assert.equal(await a.archivePerson(A,"alice",created.id),false);
  const audit=await pool.query(
    "SELECT action, actor_id FROM crm_audit WHERE tenant_id=$1 ORDER BY id", [A]);
  assert.deepEqual(audit.rows.map(x=>x.action),[
    "created","created","linked_organization","archived"
  ]);
  assert.ok(audit.rows.every(x=>x.actor_id==="alice"));
  console.log("CRM real PostgreSQL CRUD, audit and cross-tenant predicates: PASS");
} finally {
  await pool.end();
}
