#!/usr/bin/env node
/**
 * Syndes live pre-deploy smoke. Read-only, no credentials.
 * Run on the DevServer01 with Docker and Tailscale.
 * Fails closed: a working HTML shell does NOT mean an operational Inbox.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const host=process.env.SYNDES_WORKSPACE_HOST || "delmacy-desktoppc.tayra-delta.ts.net";
const origin=process.env.SYNDES_TRAEFIK_LOCAL || "http://127.0.0.1";
const tenant=process.env.SYNDES_TENANT_ID || "00000000-0000-4000-8000-000000000001";
const fetchWithHost=async(path)=>{
 const output=execFileSync("curl",["--silent","--show-error","--max-time","5","--header","Host: "+host,"--output","/dev/null","--write-out","%{http_code}",origin+path],{encoding:"utf8",timeout:6500});
 return {status:Number(output.trim()),ok:Number(output.trim())>=200 && Number(output.trim())<300};
};
const failures=[];
function check(ok,message){console.log((ok?"PASS ":"FAIL ")+message);if(!ok)failures.push(message);}
try {
 const html=await fetchWithHost("/");
 check(html.status===200,"Traefik serves Workspace HTML on intended host");
 const config=await fetchWithHost("/workspace-runtime.json");
 check(config.status===200,"Workspace runtime configuration accessible");

 const api=await fetchWithHost("/v1/tenants/"+tenant+"/inbox/conversations?limit=1");
 check(api.status===401||api.status===403,"Inbox API reachable and rejects anonymous requests (expected 401/403, got "+api.status+")");
} catch(e){failures.push("HTTP readiness: "+(e instanceof Error?e.message:String(e)));}
try {
 const result=JSON.parse(execFileSync("docker",["inspect","syndes-core-host-whatsapp-v2","--format","{{json .State}}"],{encoding:"utf8",timeout:5000}));
 check(result.Running===true && result.Restarting!==true,"WhatsApp Core Host running without restart loop");
} catch(e){failures.push("Core Host container health could not be verified");}
try {
 const text=execFileSync("docker",["exec","syndes-security-access-openbao-1","bao","status","-format=json"],{encoding:"utf8",timeout:5000,stdio:["ignore","pipe","pipe"]});
 const health=JSON.parse(text);
 check(health.sealed===false,"OpenBao is unsealed");
} catch {check(false,"OpenBao unsealed check failed (sealed or inaccessible)");}
if(failures.length){console.error("\nPREDEPLOY BLOCKED: "+failures.join("; "));process.exitCode=1;}
else console.log("\nPASS: Workspace and Inbox readiness confirmed (no live tenant data accessed)");
