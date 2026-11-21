import test from "node:test";
import assert from "node:assert/strict";
import {ensurePilotUser} from "../deploy/stage-pilot-user.mjs";

const id="12345678-1234-4234-8234-123456789abc";
function fixture(initial){
 let user=initial&&structuredClone(initial);
 const writes=[];
 const request=async(path,method="GET",body)=>{
  if(method==="POST"){
   writes.push({method,body});user={...body,id};return {status:201};
  }
  if(method==="PUT"){
   writes.push({method,body});Object.assign(user,body);return {status:204};
  }
  return {status:200,json:path.includes("?username=")?(user?[user]:[]):structuredClone(user)};
 };
 return {writes,options:{request,prefix:"/admin/realms/syndes-pilot",
  username:"pilot-founder",password:"synthetic-only"}};
}
test("stage pilot create supplies required names; replay never resets a password",async()=>{
 const f=fixture();
 assert.equal(await ensurePilotUser(f.options),id);
 assert.equal(await ensurePilotUser({...f.options,password:"different"}),id);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].body.firstName,"Syndes");
 assert.equal(f.writes[0].body.lastName,"Pilot");
 assert.equal(f.writes[0].body.credentials[0].value,"synthetic-only");
});
test("recover incomplete profile without changing required actions, names or credentials",async()=>{
 const f=fixture({id,username:"pilot-founder",enabled:true,firstName:"Existing",
  requiredActions:["UPDATE_PASSWORD"]});
 await ensurePilotUser(f.options);
 await ensurePilotUser(f.options);
 assert.deepEqual(f.writes,[{method:"PUT",body:{lastName:"Pilot"}}]);
});
test("disabled or conflicting identity is denied before profile/grant mutation",async()=>{
 for(const user of [
  {id,username:"pilot-founder",enabled:false},
  {id,username:"someone-else",enabled:true},
  {id:"bad",username:"pilot-founder",enabled:true},
 ]){
  const f=fixture(user);
  await assert.rejects(()=>ensurePilotUser(f.options),/PILOT_USER_CONFLICT/);
  assert.deepEqual(f.writes,[]);
 }
 const f=fixture();
 await assert.rejects(()=>ensurePilotUser({...f.options,username:"real-customer"}),/PILOT_USER_NAME/);
 assert.deepEqual(f.writes,[]);
});
