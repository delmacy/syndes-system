#!/usr/bin/env bash
# DevServer01 identity/authorization probe; read-only and executed by GitHub Actions.
# This is not an E2E grant/membership acceptance test: it never supplies a user token.
set -Eeuo pipefail
[[ "$#" -eq 0 ]] || { echo 'Unexpected arguments' >&2; exit 2; }
[[ "$(id -un)" == "delmacy" && "$(hostname -s)" == "DevServer01" ]] || {
  echo 'Unexpected remote identity' >&2; exit 2;
}
command -v docker >/dev/null || exit 2
core_id="$(docker ps \
  --filter 'label=com.docker.compose.project=syndes-whatsapp-cutover' \
  --filter 'label=com.docker.compose.service=core-host-whatsapp' \
  --format '{{.ID}}')"
[[ "$core_id" =~ ^[0-9a-f]+$ ]] || {
  echo 'Expected exactly one running Core Host container' >&2; exit 3;
}
image="$(docker inspect --format '{{.Config.Image}}' "$core_id")"
[[ "$image" =~ ^syndes/core-host:git-[a-f0-9]{40}$ ]] || {
  echo 'Core Host image does not match immutable GitHub release format' >&2; exit 3;
}
[[ "$(docker inspect --format '{{.State.Running}}' "$core_id")" == true ]] || exit 3

# Run using the deployed Node runtime's own network namespace and environment.
# No passwords, secrets, JWTs, Keycloak accounts, FGA stores or DB rows are read.
# Never print environment variables or responses containing user data.
docker exec -i "$core_id" node --input-type=module - <<'NODE'
const base = "http://127.0.0.1:8082";
const tenant = "4ab44379-d557-4df6-a2be-d44e121a8077";
const issuer = process.env.CORE_KEYCLOAK_ISSUER;
const jwks = process.env.CORE_KEYCLOAK_JWKS_URL;
const fga = process.env.CORE_OPENFGA_URL;
const audience = process.env.CORE_KEYCLOAK_AUDIENCE;
if (![issuer,jwks,fga,audience].every(x=>typeof x==="string" && x.trim())) {
  throw Error("Missing deployed Keycloak/OpenFGA public runtime settings");
}
async function fetchSafe(label,url,init={},expected=200) {
  let response;
  try {
    response=await fetch(url,{
      ...init,cache:"no-store",redirect:"error",
      signal:AbortSignal.timeout(6000)
    });
  } catch {
    throw Error(label+": network/TLS/timeout failure");
  }
  if(response.status!==expected)throw Error(label+": expected HTTP "+expected+" got "+response.status);
  return response;
}
const status=async(label,path,expected,init={})=>{
  await fetchSafe(label,base+path,init,expected);
  console.log(label+": PASS");
};
await status("CORE_HEALTHZ", "/healthz", 200);
await status("CORE_READYZ", "/readyz", 200);
for(const [module,clientId] of [["inbox","syndes-inbox-ui"],["crm","syndes-crm-ui"]]){
  const response=await fetchSafe("OIDC_MODULE_"+module,base+"/modules/"+module+"/config");
  const config=await response.json();
  if(config.issuer!==issuer||config.clientId!==clientId){
    throw Error("OIDC_MODULE_"+module+": deployed issuer/client mapping mismatch");
  }
  console.log("OIDC_MODULE_"+module.toUpperCase()+": PASS");
}
const keysResponse=await fetchSafe("KEYCLOAK_JWKS",jwks);
const keys=(await keysResponse.json()).keys;
if(!Array.isArray(keys)||!keys.some(k=>k.kty==="RSA" && k.use!=="enc")){
  throw Error("KEYCLOAK_JWKS: no verification RSA key available");
}
console.log("KEYCLOAK_JWKS_REACHABLE: PASS");
const fgaHealth=await fetchSafe("OPENFGA_HEALTH",new URL("/healthz",fga));
const health=await fgaHealth.json();
if(health.status!=="SERVING")throw Error("OPENFGA_HEALTH: not SERVING");
console.log("OPENFGA_READINESS_REACHABLE: PASS");
const badBearer={authorization:"Bearer ci-invalid-not-a-jwt"};
const route="/v1/tenants/"+tenant;
await status("ANONYMOUS_AUTHORIZE_DENIED",route+"/authorize",401,{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"read",resource:"inbox:conversations"})
});
await status("INVALID_JWT_AUTHORIZE_DENIED",route+"/authorize",401,{
  method:"POST",headers:{...badBearer,"content-type":"application/json"},
  body:JSON.stringify({action:"read",resource:"inbox:conversations"})
});
await status("ANONYMOUS_CRM_DENIED",route+"/crm/people",401);
await status("INVALID_JWT_CRM_DENIED",route+"/crm/people",401,{headers:badBearer});
await status("ANONYMOUS_INBOX_DENIED",route+"/inbox/conversations",401);
await status("INVALID_JWT_INBOX_DENIED",route+"/inbox/conversations",401,{headers:badBearer});
console.log("DEVSERVER01_IDENTITY_READONLY_PROBE_PASS");
console.log("AUTH_POSITIVE_MEMBERSHIP_FGA_NOT_TESTED: no approved operational test subject/token/grants");
NODE
