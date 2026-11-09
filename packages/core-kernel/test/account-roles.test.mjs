import assert from "node:assert/strict";
import test from "node:test";
import {accountRolePermits} from "../dist/index.js";

const T1="11111111-1111-4111-8111-111111111111";
const T2="22222222-2222-4222-8222-222222222222";
const owner={id:"syndes-owner-sub",kind:"user"};
const admin={id:"client-account-admin-sub",kind:"user"};
const verified=(actor=owner,tenantId=T1,role="owner")=>({
 actor,tenantId,
 membership:{tenantId,principalId:actor.id,state:"active"},
 grant:{tenantId,principalId:actor.id,state:"active",role},
});
const permits=(ctx,capability)=>accountRolePermits({...ctx,capability});

test("owner has account-level administrative entitlements, not operational resource access",()=>{
 const ctx=verified();
 for(const c of ["account.profile.read","account.profile.manage","account.members.read",
                 "account.members.manage","account.roles.manage","account.billing.read"]){
  assert.equal(permits(ctx,c),true,c);
 }
 for(const forbidden of ["crm.people.read","inbox.conversations.read",
                          "support.tickets.read","whatsapp.accounts.write",
                          "platform.tenants.manage","workspace.members.manage"]){
  assert.equal(permits(ctx,forbidden),false,
   "Account ownership is not authority for "+forbidden);
 }
});

test("delegated account admin cannot manage owners or see billing automatically",()=>{
 const ctx=verified(admin,T1,"admin");
 for(const c of ["account.profile.read","account.profile.manage","account.members.read",
                 "account.members.manage"])assert.equal(permits(ctx,c),true);
 assert.equal(permits(ctx,"account.roles.manage"),false);
 assert.equal(permits(ctx,"account.billing.read"),false);
});

test("platform owner status does not grant a single account permission",()=>{
 const ctx={...verified(),grant:null,platformRole:"owner"};
 assert.equal(permits(ctx,"account.profile.read"),false);
 assert.equal(permits({...ctx,membership:null},"account.members.manage"),false);
});

test("cross-account grants or memberships never authorize another client",()=>{
 const ctx=verified(owner,T1,"owner");
 assert.equal(permits({...ctx,tenantId:T2},"account.members.manage"),false);
 assert.equal(permits({...ctx,grant:{...ctx.grant,tenantId:T2}},"account.members.manage"),false);
 assert.equal(permits({...ctx,membership:{...ctx.membership,tenantId:T2}},"account.members.manage"),false);
 const other=verified(admin,T2,"owner");
 assert.equal(permits({...ctx,grant:other.grant},"account.profile.read"),false);
});

test("principal identity is mandatory; email, service principals and forged grants cannot substitute",()=>{
 const ctx=verified();
 assert.equal(permits({...ctx,actor:{id:"other-sub",kind:"user"}},"account.profile.read"),false);
 assert.equal(permits({...ctx,actor:{id:owner.id,kind:"service"}},"account.profile.read"),false);
 assert.equal(permits({...ctx,actor:{id:"",kind:"user"}},"account.profile.read"),false);
 assert.equal(permits({...ctx,actor:null},"account.profile.read"),false);
 assert.equal(permits({...ctx,tenantId:"not-a-uuid"},"account.profile.read"),false);
});

test("membership or grant revocation immediately removes account permission",()=>{
 const ctx=verified();
 assert.equal(permits(ctx,"account.members.read"),true);
 assert.equal(permits({...ctx,membership:{...ctx.membership,state:"revoked"}},"account.members.read"),false);
 assert.equal(permits({...ctx,grant:{...ctx.grant,state:"revoked"}},"account.members.read"),false);
 assert.equal(permits({...ctx,grant:null},"account.members.read"),false);
 assert.equal(permits({...ctx,membership:null},"account.members.read"),false);
});

test("unknown database roles fail closed without implicit fallback",()=>{
 const ctx=verified();
 for(const role of ["platform_owner","superadmin","supervisor","editor","viewer","ROOT",null]){
  assert.equal(permits({...ctx,grant:{...ctx.grant,role}},"account.profile.read"),false);
 }
});
