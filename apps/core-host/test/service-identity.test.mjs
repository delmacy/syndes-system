import test from "node:test";
import assert from "node:assert/strict";
import {actorFromVerifiedClaims} from "../dist/adapters.js";

test("ordinary browser Keycloak access tokens produce human actors",()=>{
 assert.deepEqual(actorFromVerifiedClaims({sub:"user-uuid",azp:"syndes-inbox-ui",preferred_username:"ana"},new Set(["syndes-whatsapp-gateway"])),
 {id:"user-uuid",kind:"user"});
});
test("allowlisted Keycloak service account has explicit service kind",()=>{
 const identity=actorFromVerifiedClaims({sub:"account-uuid",azp:"syndes-whatsapp-gateway",
 preferred_username:"service-account-syndes-whatsapp-gateway"},new Set(["syndes-whatsapp-gateway"]));
 assert.deepEqual(identity,{id:"account-uuid",kind:"service"});
});
test("unapproved or spoofed service claims are rejected",()=>{
 assert.throws(()=>actorFromVerifiedClaims({sub:"svc",azp:"evil-client",preferred_username:"service-account-evil-client"},
 new Set(["syndes-whatsapp-gateway"])),/not allowed/);
 assert.throws(()=>actorFromVerifiedClaims({sub:"svc",azp:"syndes-whatsapp-gateway",preferred_username:"ana"},
 new Set(["syndes-whatsapp-gateway"])),/Unexpected human/);
 assert.throws(()=>actorFromVerifiedClaims({sub:"svc",azp:"syndes-whatsapp-gateway",preferred_username:"service-account-evil-client"},
 new Set(["syndes-whatsapp-gateway"])),/not allowed/);
 assert.throws(()=>actorFromVerifiedClaims({sub:"",azp:"syndes-inbox-ui" },new Set()),/missing subject/);
});
