import test from "node:test";
import assert from "node:assert/strict";
import { CoreKernel, AccessDeniedError } from "@syndes/core-kernel";
import { crmModule, CrmService, PgCrmRepositoryFactory, CrmValidationError, TenantDatabaseMismatchError } from "../dist/index.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const alice={actor:{kind:"user",id:"alice"},tenantId:A};

class MemoryRepo{
  people=new Map();
  organizations=new Map();
  links=new Set();
  tags=new Map();
  notes=new Map();
  createOrganization(tenantId,_actorId,id,input) {
    const o={id,tenantId,legalName:input.legalName,tradeName:input.tradeName,taxId:input.taxId,archivedAt:null};
    this.organizations.set(id,o);return Promise.resolve(o);
  }
  createPerson(tenantId,_actorId,id,input){
    const p={id,tenantId,name:input.name,email:input.email,phone:input.phone,archivedAt:null};
    this.people.set(id,p);return Promise.resolve(p);
  }
  async linkPerson(tenantId,_actorId,personId,organizationId){
    const p=this.people.get(personId),o=this.organizations.get(organizationId);
    if(!p||!o||p.tenantId!==tenantId||o.tenantId!==tenantId||p.archivedAt||o.archivedAt){
      throw new Error("Tenant relation denied");
    }
    this.links.add([tenantId,personId,organizationId].join("|"));
    return {tenantId,personId,organizationId};
  }
  async createTag(tenantId,_actorId,id,label){
    const tag={id,tenantId,label};this.tags.set(id,tag);return tag;
  }
  async tagPerson(tenantId,_actorId,personId,tagId){
    const p=this.people.get(personId),t=this.tags.get(tagId);
    if(!p||!t||p.tenantId!==tenantId||t.tenantId!==tenantId||p.archivedAt){
      throw new Error("Tenant tag denied");
    }
    return {tenantId,personId,tagId};
  }
  async createNote(tenantId,actorId,id,personId,body){
    const p=this.people.get(personId);
    if(!p||p.tenantId!==tenantId||p.archivedAt)throw new Error("Tenant note denied");
    const note={id,tenantId,personId,body,createdBy:actorId,createdAt:new Date().toISOString()};
    this.notes.set(id,note);return note;
  }
  async listTimeline(tenantId,personId,limit){
    return [...this.notes.values()].filter(n=>n.tenantId===tenantId&&n.personId===personId)
      .slice(0,limit).map((n,index)=>({id:index+1,tenantId,personId,
        actorId:n.createdBy,action:"noted",recordedAt:n.createdAt}));
  }
  async getPerson(tenantId,id){
    const p=this.people.get(id);return p?.tenantId===tenantId&&!p.archivedAt?p:null;
  }
  async listPeople(tenantId,query,limit){
    return [...this.people.values()].filter(p=>p.tenantId===tenantId&&!p.archivedAt&&
      (!query||p.name.toLowerCase().includes(query.toLowerCase())||p.email?.includes(query)||p.phone?.includes(query))).slice(0,limit);
  }
  async archivePerson(tenantId,_actorId,id){
    const p=this.people.get(id);if(!p||p.tenantId!==tenantId||p.archivedAt)return false;
    this.people.set(id,{...p,archivedAt:new Date().toISOString()});return true;
  }
}
async function app(options={}){
  let selects=0;
  const store=new Map([[A,new MemoryRepo()],[B,new MemoryRepo()]]);
  const kernel=new CoreKernel({
    modules:[{id:"platform",version:"0.1.0"},crmModule],
    tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="alice"?
      tenantId===A:actor.id==="bob"&&tenantId===B},
    authorization:{canAccess:async({action,...query})=>options.deny!=="all" &&
      (options.deny!=="write"||action!=="write") && !!query.resource},
  });
  await kernel.start();
  const crm=new CrmService(kernel,async id=>{
    selects++;
    const repo=store.get(id);
    if(!repo)throw new Error("No trusted tenant DB mapping");
    return repo;
  });
  return {crm,store,selects:()=>selects};
}

test("CRM registers as a dependency-ordered extension, not part of kernel",()=>{
  assert.equal(crmModule.id,"crm");
  assert.deepEqual(crmModule.dependencies,["platform"]);
});

test("create, normalize, relate, search, archive and hide archived records",async()=>{
  const {crm}=await app();
  const organization=await crm.createOrganization(alice,{legalName:"  Oficina  Alfa  ",taxId:"12.345.678/0001-90"});
  assert.equal(organization.legalName,"Oficina Alfa");
  assert.equal(organization.taxId,"12345678000190");
  const person=await crm.createPerson(alice,{
    name:"  Ana   Lima ",email:"  ANA@example.COM  ",phone:"(51) 99999-0000",
  });
  assert.deepEqual([person.name,person.email,person.phone],["Ana Lima","ana@example.com","+51999990000"]);
  const relation=await crm.linkPerson(alice,person.id,organization.id);
  assert.deepEqual([relation.personId,relation.organizationId],[person.id,organization.id]);
  assert.equal((await crm.listPeople(alice,"ana")).length,1);
  assert.equal(await crm.archivePerson(alice,person.id),true);
  assert.equal(await crm.archivePerson(alice,person.id),false);
  assert.equal(await crm.getPerson(alice,person.id),null);
  assert.deepEqual(await crm.listPeople(alice),[]);
});

test("deny before any database resolution; no cross-tenant leaked data",async()=>{
  const {crm,selects}=await app();
  await crm.createPerson(alice,{name:"Secret for A"});
  const before=selects();
  await assert.rejects(crm.listPeople({...alice,tenantId:B}),AccessDeniedError);
  assert.equal(selects(),before,"repository was resolved before tenant auth");
  await assert.rejects(crm.getPerson({...alice,tenantId:B},
    "9b3df87e-ec6c-46f5-9339-3a6851da0119"),AccessDeniedError);
  assert.equal(selects(),before);
});

test("policy denial also occurs before tenant connection is selected",async()=>{
  const {crm,selects}=await app({deny:"write"});
  await assert.rejects(crm.createPerson(alice,{name:"Denied"}),AccessDeniedError);
  assert.equal(selects(),0);
});
test("invalid input and unsafe search limits are rejected",async()=>{
  const {crm}=await app();
  assert.throws(()=>crm.createPerson(alice,{name:"  "}),CrmValidationError);
  assert.throws(()=>crm.createPerson(alice,{name:"Ana",email:"not-an-email"}),CrmValidationError);
  assert.throws(()=>crm.createPerson(alice,{name:"Ana",phone:"123"}),CrmValidationError);
  assert.throws(()=>crm.listPeople(alice,"x",1000),CrmValidationError);
  assert.throws(()=>crm.archivePerson(alice,"../../etc/passwd"),CrmValidationError);
  assert.throws(()=>crm.createTag(alice,""),CrmValidationError);
  assert.throws(()=>crm.createTag(alice,"x".repeat(65)),CrmValidationError);
  assert.throws(()=>crm.createNote(alice,"9b3df87e-ec6c-46f5-9339-3a6851da0119",""),CrmValidationError);
  assert.throws(()=>crm.listTimeline(alice,"9b3df87e-ec6c-46f5-9339-3a6851da0119",200),CrmValidationError);

});

test("a trusted database resolver must return the same canonical tenant ID",async()=>{
  const factory=new PgCrmRepositoryFactory({resolve:async()=>({
    tenantId:B,query:async()=>({rows:[],rowCount:0}),
  })});
  await assert.rejects(factory.forTenant(A),TenantDatabaseMismatchError);
  await assert.rejects(factory.forTenant("tenant-a"),TenantDatabaseMismatchError);
});
test("PostgreSQL operations are tenant-filtered and parameterized",async()=>{
  let audit=[];
  const db={tenantId:A,query:async(sql,values)=>{
    audit.push({sql,values});
    if(sql.includes("INSERT INTO crm_people"))return {rows:[{
      id:values[0],tenant_id:values[1],name:values[2],
      email:values[3],phone:values[4],archived_at:null,
    }],rowCount:1};
    return {rows:[],rowCount:0};
  }};
  const factory=new PgCrmRepositoryFactory({resolve:async()=>db});
  const repo=await factory.forTenant(A);
  const person=await repo.createPerson(A,"alice","9b3df87e-ec6c-46f5-9339-3a6851da0119",
    {name:"Ana",email:null,phone:null});
  assert.equal(person.tenantId,A);
  assert.match(audit[0].sql,/INSERT INTO crm_audit/);
  assert.match(audit[0].sql,/\$2::uuid/);
  await repo.getPerson(A,person.id);
  assert.deepEqual(audit[1].values,[A,person.id]);
  assert.match(audit[1].sql,/tenant_id=\$1::uuid/);
});

test("tags, notes and timeline respect authorized tenant context",async()=>{
  const {crm,selects}=await app();
  const p=await crm.createPerson(alice,{name:"Marina"});
  const tag=await crm.createTag(alice,"  Atendimento VIP ");
  assert.equal(tag.label,"Atendimento VIP");
  const link=await crm.tagPerson(alice,p.id,tag.id);
  assert.equal(link.personId,p.id);
  const note=await crm.createNote(alice,p.id," Primeiro atendimento\nEnviar retorno ");
  assert.equal(note.body,"Primeiro atendimento\nEnviar retorno");
  assert.equal((await crm.listTimeline(alice,p.id))[0].action,"noted");
  const before=selects();
  await assert.rejects(crm.createNote({...alice,tenantId:B},p.id,"Vazamento"),AccessDeniedError);
  await assert.rejects(crm.tagPerson({...alice,tenantId:B},p.id,tag.id),AccessDeniedError);
  await assert.rejects(crm.listTimeline({...alice,tenantId:B},p.id),AccessDeniedError);
  assert.equal(selects(),before);
});
