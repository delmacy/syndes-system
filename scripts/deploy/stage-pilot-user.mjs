// Only synthetic users in the isolated pilot realm. Never resets credentials,
// clears required actions, re-enables users or changes organization membership.
export function assertPilotIdentityRequest(mode,service,path,method){
 if(!["provision","verify"].includes(mode))throw Error("PILOT_IDENTITY_MODE");
 if(mode==="provision")return;
 if(method==="GET")return;
 // OpenFGA check uses POST but cannot create models, stores or tuples.
 if(service==="fga"&&method==="POST"&&/^\/stores\/[A-Za-z0-9_-]{8,128}\/check$/.test(path))return;
 throw Error("PILOT_READY_IDENTITY_MUTATION_DENIED");
}

export async function ensurePilotUser({request, prefix, username, password}) {
 if (!/^pilot-(founder|b-only)$/.test(username)) throw Error("PILOT_USER_NAME");
 const lookup=async()=>{
  const {json}=await request(prefix+"/users?username="+encodeURIComponent(username)+"&exact=true");
  if(!Array.isArray(json))throw Error("PILOT_USERS_LIST");
  return json;
 };
 let users=await lookup();
 if(users.length===0){
  await request(prefix+"/users","POST",{
   username,enabled:true,email:username+"@example.invalid",emailVerified:true,
   firstName:"Syndes",lastName:"Pilot",requiredActions:[],
   credentials:[{type:"password",value:password,temporary:false}],
  },[201,204]);
  users=await lookup();
 }
 const user=users[0];
 if(users.length!==1||user.username!==username||user.enabled!==true||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id))
  throw Error("PILOT_USER_CONFLICT");
 // Recover users created by the previous incomplete bootstrap. Send only
 // missing profile fields: existing passwords, actions and grants are intact.
 const profile={};
 if(!user.firstName?.trim())profile.firstName="Syndes";
 if(!user.lastName?.trim())profile.lastName="Pilot";
 if(Object.keys(profile).length){
  await request(prefix+"/users/"+user.id,"PUT",profile,[204]);
  const {json:verified}=await request(prefix+"/users/"+user.id);
  if(verified?.id!==user.id||verified.enabled!==true||
     !verified.firstName?.trim()||!verified.lastName?.trim())
   throw Error("PILOT_USER_PROFILE_REPAIR_FAILED");
 }
 return user.id;
}
