import {runIam06bLab} from "./iam06b-composite-ci.mjs";
// IAM-03 REAL DISPOSABLE Keycloak 26.8.1 experiment.
// Imported only from existing Platform Manager CI, on its loopback-only container.
// No change to production realm, stores, credentials, tenants or provider configs.
// CI users/password grants exist only inside a disposable realm and container.
import assert from "node:assert/strict";

const LAB_REALM="syndes-iam-lab-ci";
const PASSWORD="ci-only-disposable-iam-user";
const policyClient="syndes-policy-api";
const uiClient="syndes-iam-lab-ui";
const tenant="11111111-1111-4111-8111-111111111111";
const alpha="22222222-2222-4222-8222-222222222222";
const beta="33333333-3333-4333-8333-333333333333";
const workspaceA="44444444-4444-4444-8444-444444444444";
const workspaceB="55555555-5555-4555-8555-555555555555";
const funnelA="66666666-6666-4666-8666-666666666666";
const funnelB="77777777-7777-4777-8777-777777777777";
const prefix="/admin/realms/"+LAB_REALM;
const resourceName=(org,ws,funnel)=>"syndes:v1:tenant:"+tenant+":org:"+org+
  ":workspace:"+ws+(funnel?":funnel:"+funnel:"");
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const mustId=(value,label)=>{assert.match(value||"",uuid,label);return value;};

export async function runIam03Lab({base,adminToken,managerToken}){
  assert.equal(process.env.CI_MASTER_REAL_PG,"1","IAM lab must run inside existing disposable CI only");
  assert.equal(base,"http://127.0.0.1:18088","Refuse anything except disposable Keycloak");
  assert.match(adminToken||"",/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  // No error response body, location, token, password, subject, SQL row or cookie in logs.
  let stage="realm";
  async function call(path,method="GET",token=adminToken,payload,success=[200,201,204],type="json"){
    const headers={Accept:"application/json"};
    if(token) headers.Authorization="Bearer "+token;
    let body;
    if(payload!==undefined){
      headers["Content-Type"]=type==="form"?"application/x-www-form-urlencoded":"application/json";
      body=type==="form"?new URLSearchParams(payload).toString():JSON.stringify(payload);
    }
    let resp;
    try {
      resp=await fetch(base+path,{method,headers,body,redirect:"error",
        signal:AbortSignal.timeout(12000),cache:"no-store"});
    } catch {
      throw Error("IAM03_"+stage+"_TRANSPORT_BLOCKED");
    }
    if(!success.includes(resp.status)){
      // Diagnostics are limited to sanitized OAuth error categories. Never
      // echo raw responses, tokens, user IDs or credential values into CI.
      let reason="";
      if(stage==="uma" && resp.status===400){
        let fault={};
        try{fault=await resp.json()}catch{}
        const error=typeof fault?.error==="string"&&/^[a-z_]{3,40}$/.test(fault.error)
          ?fault.error:"unknown";
        const detail=typeof fault?.error_description==="string"
          ?fault.error_description.toLowerCase():"";
        const category=
          detail.includes("client does not support permissions")?"NO_RESOURCE_SERVER":
          detail.includes("resource with id")?"RESOURCE_ID_MISSING":
          detail.includes("scope")?"SCOPE_INVALID":
          detail.includes("resource server")?"AUDIENCE_INVALID":
          detail.includes("client")?"CLIENT_AUTH_INVALID":
          detail.includes("permissions")?"PERMISSION_INVALID":
          detail.includes("identity")?"IDENTITY_INVALID":"UNCLASSIFIED";
        reason="_"+error+"_"+category;
      }
      throw Error("IAM03_"+stage+"_STATUS_"+resp.status+reason);
    }
    const value=resp.status===204?null:await resp.text();
    let parsed=null;
    if(value){
      try{parsed=JSON.parse(value)}catch{
        if(resp.status===200)throw Error("IAM03_"+stage+"_INVALID_JSON");
      }
    }
    return {json:parsed,status:resp.status,location:resp.headers.get("location")};
  }
  const get=async(path)=> (await call(path)).json;
  const post=async(path,body)=>call(path,"POST",adminToken,body,[200,201,204]);
  const resolveCreatedId=async({location},path,field,value)=>{
    if(location){
      const id=location.slice(location.lastIndexOf("/")+1);
      if(uuid.test(id))return id;
    }
    const list=await get(path);
    assert.ok(Array.isArray(list),"IAM03_"+stage+"_EXPECTED_LIST");
    const matches=list.filter(x=>x[field]===value);
    assert.equal(matches.length,1,"IAM03_"+stage+"_UNIQUE_ENTITY");
    return mustId(matches[0].id||matches[0]._id,"IAM03_"+stage+"_ID");
  };
  stage="realm";
  await post("/admin/realms",{
    realm:LAB_REALM,enabled:true,organizationsEnabled:true,sslRequired:"none",
    registrationAllowed:false,resetPasswordAllowed:false,loginWithEmailAllowed:false
  });
  const realm=await get(prefix);
  assert.equal(realm.organizationsEnabled,true,"IAM03_ORGANIZATIONS_NOT_ENABLED");

  stage="clients";
  await post(prefix+"/clients",{
    clientId:uiClient,enabled:true,protocol:"openid-connect",publicClient:true,
    standardFlowEnabled:true,directAccessGrantsEnabled:true,implicitFlowEnabled:false,
    serviceAccountsEnabled:false,
    redirectUris:["https://iam-lab.ci.syndes.invalid/callback"],
    webOrigins:["https://iam-lab.ci.syndes.invalid"],
    // The Host requires signed aud + azp. CI password grant is NOT PKCE production login.
    protocolMappers:[{
      name:"ci-core-audience",protocol:"openid-connect",
      protocolMapper:"oidc-audience-mapper",
      config:{"included.custom.audience":"syndes-core",
        "access.token.claim":"true","id.token.claim":"false"}
    }]
  });
  await post(prefix+"/clients",{
    clientId:policyClient,enabled:true,protocol:"openid-connect",
    publicClient:false,clientAuthenticatorType:"client-secret",
    authorizationServicesEnabled:true,serviceAccountsEnabled:true,
    standardFlowEnabled:false,directAccessGrantsEnabled:false,implicitFlowEnabled:false,
    fullScopeAllowed:false
  });
  const clients=await get(prefix+"/clients");
  const resourceServerClient=clients.find(c=>c.clientId===policyClient);
  assert.ok(resourceServerClient,"IAM03_POLICY_CLIENT_MISSING");
  const clientId=mustId(resourceServerClient.id,"IAM03_POLICY_CLIENT_ID");
  const authz=prefix+"/clients/"+clientId+"/authz/resource-server";
  const server=await get(authz);
  assert.equal(server.policyEnforcementMode,"ENFORCING","IAM03_EXPECT_ENFORCING");
  // Explicitly remove Keycloak's sample Default Resource/Permission. Their
  // out-of-box allow policy must NEVER be mistaken for fine-grained IAM.
  const defaults=await get(authz+"/permission");
  assert.ok(Array.isArray(defaults),"IAM03_DEFAULT_PERMISSIONS_UNEXPECTED");
  for(const permission of defaults.filter(x=>x.name==="Default Permission")){
    stage="remove-default";
    await call(authz+"/policy/"+mustId(permission.id,"default permission"),"DELETE",
      adminToken,undefined,[200,204]);
  }
  const baseResources=await get(authz+"/resource");
  assert.ok(Array.isArray(baseResources));
  for(const resource of baseResources.filter(x=>x.name==="Default Resource")){
    stage="remove-default-resource";
    await call(authz+"/resource/"+mustId(resource._id||resource.id,"default resource"),
      "DELETE",adminToken,undefined,[200,204]);
  }
  const afterDefaults=await get(authz+"/permission");
  assert.ok(!afterDefaults.some(x=>x.name==="Default Permission"),"IAM03_DEFAULT_POLICY_NOT_REMOVED");

  stage="users";
  for(const username of ["iam-alice","iam-bob"]){
    await post(prefix+"/users",{
      username,enabled:true,email:username+"@example.invalid",emailVerified:true,
      firstName:"IAM",lastName:"Disposable",requiredActions:[],
      credentials:[{type:"password",value:PASSWORD,temporary:false}]
    });
  }
  const users=await get(prefix+"/users");
  const alice=mustId(users.find(u=>u.username==="iam-alice")?.id,"IAM03_ALICE");
  const bob=mustId(users.find(u=>u.username==="iam-bob")?.id,"IAM03_BOB");
  assert.notEqual(alice,bob);

  stage="organizations";
  const orgs={};
  for(const [key,name] of [
    ["a","iam-alpha"],
    ["b","iam-beta"]
  ]){
    // Keycloak 26 requires URL-safe Organization aliases; no domains needed
    // for a synthetic CI organization and @example.invalid identities.
    const created=await post(prefix+"/organizations",{
      name,alias:name,enabled:true
    });
    const id=await resolveCreatedId(created,prefix+"/organizations","name",name);
    orgs[key]=id;
    assert.equal((await get(prefix+"/organizations/"+id)).name,name);
  }
  stage="org-members";
  for(const [org,user] of [[orgs.a,alice],[orgs.b,bob]]){
    // Keycloak Org API expects a JSON string holding the immutable user UUID.
    await call(prefix+"/organizations/"+org+"/members","POST",adminToken,user,[201,204]);
    const member=await get(prefix+"/organizations/"+org+"/members/"+user);
    assert.equal(member.id,user,"IAM03_ORG_MEMBERSHIP_NOT_CREATED");
  }
  const membership=async(org,user)=>{
    const res=await call(prefix+"/organizations/"+org+"/members/"+user,"GET",
      adminToken,undefined,[200,404]);
    return res.status===200&&res.json?.id===user;
  };
  assert.equal(await membership(orgs.a,alice),true);
  assert.equal(await membership(orgs.b,bob),true);
  assert.equal(await membership(orgs.a,bob),false);
  assert.equal(await membership(orgs.b,alice),false);


  // IAM-05B: use client_credentials with realm-management view-users
  // and view-organizations roles. No realm administration or write grants.
  stage="service-membership";
  const readerClient="syndes-iam-membership-reader";
  await post(prefix+"/clients",{
    clientId:readerClient,enabled:true,protocol:"openid-connect",
    publicClient:false,clientAuthenticatorType:"client-secret",
    serviceAccountsEnabled:true,standardFlowEnabled:false,
    directAccessGrantsEnabled:false,fullScopeAllowed:false,
  });
  const allClients=await get(prefix+"/clients");
  const reader=allClients.find(c=>c.clientId===readerClient);
  const realmManagement=allClients.find(c=>c.clientId==="realm-management");
  assert.ok(reader&&realmManagement,"IAM05B_SERVICE_CLIENTS_MISSING");
  const readerInternalId=mustId(reader.id,"IAM05B_READER_INTERNAL_ID");
  const managementInternalId=mustId(realmManagement.id,"IAM05B_REALM_MANAGEMENT_ID");
  const serviceUser=await get(prefix+"/clients/"+readerInternalId+"/service-account-user");
  assert.ok(uuid.test(serviceUser?.id),"IAM05B_SERVICE_ACCOUNT_MISSING");
  const viewUsers=await get(prefix+"/clients/"+managementInternalId+"/roles/view-users");
  assert.equal(viewUsers?.name,"view-users","IAM05B_USER_READ_ROLE_MISSING");
  const viewOrganizations=await get(prefix+"/clients/"+managementInternalId+"/roles/view-organizations");
  assert.equal(viewOrganizations?.name,"view-organizations","IAM05B_ORG_READ_ROLE_MISSING");
  const memberReadRoles=[viewUsers,viewOrganizations];
  await call(prefix+"/users/"+serviceUser.id+
    "/role-mappings/clients/"+managementInternalId,"POST",adminToken,memberReadRoles,[204]);
  // Explicit scope mapping is needed when fullScopeAllowed=false.
  await call(prefix+"/clients/"+readerInternalId+
    "/scope-mappings/clients/"+managementInternalId,"POST",adminToken,memberReadRoles,[204]);
  const readerSecret=(await get(prefix+"/clients/"+readerInternalId+"/client-secret"))?.value;
  assert.ok(typeof readerSecret==="string"&&readerSecret.length>=12,"IAM05B_SECRET_MISSING");
  const clientGrant=await call("/realms/"+LAB_REALM+"/protocol/openid-connect/token",
    "POST",null,{grant_type:"client_credentials",client_id:readerClient,
      client_secret:readerSecret},[200],"form");
  const memberToken=clientGrant.json?.access_token;
  assert.match(memberToken||"",/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const readerMembership=async(org,user)=>{
    const response=await call(prefix+"/organizations/"+org+"/members/"+user,
      "GET",memberToken,undefined,[200,404]);
    if(response.status===404)return false;
    assert.equal(response.json?.id,user,"IAM05B_SUBJECT_MISMATCH");
    assert.equal(response.json?.enabled,true,"IAM05B_DISABLED_IDENTITY");
    return true;
  };
  assert.equal(await readerMembership(orgs.a,alice),true);
  assert.equal(await readerMembership(orgs.b,bob),true);
  assert.equal(await readerMembership(orgs.a,bob),false);
  assert.equal(await readerMembership(orgs.b,alice),false);
  console.log("IAM05B_KEYCLOAK_SERVICE_READ_ONLY_ORG_MEMBERSHIP_PASS");

  stage="scopes";
  const capabilityNames=["inbox.conversation.read","inbox.message.send","inbox.conversation.claim",
    "inbox.conversation.transfer","service.funnel.operate"];
  const scopes={};
  for(const name of capabilityNames){
    const created=await post(authz+"/scope",{name,displayName:name});
    const id=created.json?.id||await resolveCreatedId(created,authz+"/scope","name",name);
    scopes[name]=mustId(id,"IAM03_SCOPE");
  }
  stage="resources";
  const resourceDefinitions=[
    {name:resourceName(alpha,workspaceA),keys:["inbox.conversation.read","inbox.message.send","inbox.conversation.claim","inbox.conversation.transfer"]},
    {name:resourceName(beta,workspaceB),keys:["inbox.conversation.read","inbox.conversation.claim","inbox.conversation.transfer"]},
    {name:resourceName(alpha,workspaceA,funnelA),keys:["service.funnel.operate"]},
    {name:resourceName(beta,workspaceB,funnelB),keys:["service.funnel.operate"]}
  ];
  const resources={};
  for(const def of resourceDefinitions){
    const created=await post(authz+"/resource",{
      name:def.name,ownerManagedAccess:false,uris:[],
      scopes:def.keys.map(k=>({id:scopes[k],name:k}))
    });
    const id=created.json?._id||created.json?.id||
      await resolveCreatedId(created,authz+"/resource","name",def.name);
    resources[def.name]=mustId(id,"IAM03_RESOURCE");
  }

  stage="policies";
  const policies={};
  for(const [key,user] of [["alice",alice],["bob",bob]]){
    const name="iam-user-"+key;
    const created=await post(authz+"/policy/user",{
      type:"user",name,logic:"POSITIVE",decisionStrategy:"UNANIMOUS",users:[user]
    });
    const id=created.json?.id||await resolveCreatedId(created,authz+"/policy","name",name);
    policies[key]=mustId(id,"IAM03_POLICY");
  }

  stage="permissions";
  const grants=[
    ["alice",alpha,workspaceA,null,"inbox.conversation.read"],
    ["alice",alpha,workspaceA,null,"inbox.message.send"],
    ["alice",alpha,workspaceA,null,"inbox.conversation.claim"],
    ["alice",alpha,workspaceA,funnelA,"service.funnel.operate"],
    ["bob",beta,workspaceB,null,"inbox.conversation.read"],
    ["bob",beta,workspaceB,null,"inbox.conversation.transfer"],
    ["bob",beta,workspaceB,funnelB,"service.funnel.operate"]
  ];
  for(let i=0;i<grants.length;i++){
    const [key,org,ws,funnel,cap]=grants[i];
    await post(authz+"/permission/scope",{
      name:"iam-permission-"+i,
      type:"scope",logic:"POSITIVE",decisionStrategy:"UNANIMOUS",
      resources:[resources[resourceName(org,ws,funnel)]],
      scopes:[scopes[cap]],policies:[policies[key]]
    });
  }

  stage="user-token";
  const acquire=async(username)=>{
    const result=await call("/realms/"+LAB_REALM+"/protocol/openid-connect/token",
      "POST",null,{
        grant_type:"password",client_id:uiClient,username,password:PASSWORD,scope:"openid"
      },[200],"form");
    assert.match(result.json?.access_token||"",/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    return result.json.access_token;
  };
  const atAlice=await acquire("iam-alice");
  const atBob=await acquire("iam-bob");
  const tokenSub=(jwt)=>JSON.parse(Buffer.from(jwt.split(".")[1],"base64url")).sub;
  assert.equal(tokenSub(atAlice),alice);
  assert.equal(tokenSub(atBob),bob);

  stage="uma";
  const decide=async(token,org,ws,funnel,cap)=>{
    const name=resourceName(org,ws,funnel);
    const id=resources[name];
    assert.ok(id&&scopes[cap],"IAM03_MISSING_TRUSTED_RESOURCE_MAPPING");
    const form={
      grant_type:"urn:ietf:params:oauth:grant-type:uma-ticket",
      audience:policyClient,permission:id+"#"+cap,
      response_mode:"decision",submit_request:"false"
    };
    const resp=await call("/realms/"+LAB_REALM+"/protocol/openid-connect/token",
      "POST",token,form,[200,403],"form");
    if(resp.status===403)return false;
    assert.deepEqual(resp.json,{result:true},"IAM03_UNEXPECTED_UMA_DECISION");
    return true;
  };
  assert.equal(await decide(atAlice,alpha,workspaceA,null,"inbox.conversation.read"),true);
  assert.equal(await decide(atAlice,alpha,workspaceA,null,"inbox.conversation.claim"),true);
  assert.equal(await decide(atAlice,alpha,workspaceA,funnelA,"service.funnel.operate"),true);
  assert.equal(await decide(atAlice,alpha,workspaceA,null,"inbox.conversation.transfer"),false);
  assert.equal(await decide(atAlice,beta,workspaceB,null,"inbox.conversation.read"),false);
  assert.equal(await decide(atAlice,beta,workspaceB,funnelB,"service.funnel.operate"),false);
  assert.equal(await decide(atBob,beta,workspaceB,null,"inbox.conversation.read"),true);
  assert.equal(await decide(atBob,beta,workspaceB,null,"inbox.conversation.transfer"),true);
  assert.equal(await decide(atBob,beta,workspaceB,funnelB,"service.funnel.operate"),true);
  assert.equal(await decide(atBob,alpha,workspaceA,null,"inbox.conversation.read"),false);
  assert.equal(await decide(atBob,alpha,workspaceA,funnelA,"service.funnel.operate"),false);

  // Revocation: a Keycloak user-policy is separate from org membership. The
  // backend MUST combine a live organization membership check with UMA. It is
  // unsafe to rely on a global user policy as if it were org-scoped.
  stage="revoke";
  await call(prefix+"/organizations/"+orgs.a+"/members/"+alice,"DELETE",
    adminToken,undefined,[200,204]);
  assert.equal(await membership(orgs.a,alice),false);
  assert.equal(await readerMembership(orgs.a,alice),false,"IAM05B_SERVICE_REVOKE_DENIED");
  const umaAfterOrgRevocation=await decide(atAlice,alpha,workspaceA,null,"inbox.conversation.read");
  const combined=await membership(orgs.a,alice)&&umaAfterOrgRevocation;
  assert.equal(combined,false,"IAM03_REVOKED_MEMBER_CANNOT_ACCESS_APP");
  // Evaluate with the SAME still-valid signed token to surface policy limits.
  console.log("IAM03_ORGANIZATIONS_ACTIVE_MEMBERS_AND_REVOCATION_PASS");
  console.log("IAM03_RESOURCE_SCOPES_FINE_GRAIN_A_B_POSITIVE_NEGATIVE_PASS");
  console.log("IAM03_UMA_REQUIRES_LIVE_ORGANIZATION_MEMBERSHIP_GUARD_PASS");
  console.log("IAM03_UMA_USER_POLICY_REMAINS_AFTER_ORG_REVOKE="+
    (umaAfterOrgRevocation?"TRUE_REQUIRES_BACKEND_GATE":"FALSE"));
  console.log("IAM03_REAL_DISPOSABLE_KEYCLOAK_PASS");
  // Same still-valid human JWT, now exercised against real Control+tenant PG17,
  // real live Organization membership, OpenFGA and real Keycloak UMA.
  await runIam06bLab({
    base,realm:LAB_REALM,adminToken,adminAccess:managerToken,
    readerClient,readerSecret,policyClient,uiClient,
    tenant,alpha,workspaceA,orgs,alice,bob,atAlice,atBob,scopes,resources,
  });
}
