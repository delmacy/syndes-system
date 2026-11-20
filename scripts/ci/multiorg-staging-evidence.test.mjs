import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("MO-REL-04 evidence job is one-shot, main-only, post-CI gate, read-only",async()=>{
 const text=await readFile(".github/workflows/syndes-ci.yml","utf8");
 const pos=text.indexOf("  devserver01-multiorg-stage-evidence:");
 assert.ok(pos>0);
 // Isolate only the evidence job; subsequent CI jobs may legitimately mutate
 // an authorized staging environment. Never weaken the evidence-job deny list.
 const rest=text.slice(pos+1);
 const next=rest.search(/\n  [a-z][a-z0-9-]+:\n/);
 const job=next<0?text.slice(pos):text.slice(pos,pos+1+next);
 assert.match(job,/github\.event_name == 'push'/);
 assert.match(job,/github\.ref == 'refs\/heads\/main'/);
 assert.match(job,/MO-REL04-DEVSERVER-STAGE-VERIFY-APPROVED/);
 assert.match(job,/needs: \[gate\]/);
 assert.match(job,/environment: devserver01/);
 assert.match(job,/issues: write/);
 assert.match(job,/id-token: write/);
 assert.match(job,/git ls-remote origin refs\/heads\/main/);
 assert.match(job,/delmacy-desktoppc\.tayra-delta\.ts\.net/);
 assert.match(job,/SYNDES_STAGING_REMOTE_MODE=read-only-v1 bash -s -- foundation/);
 assert.match(job,/SYNDES_STAGING_REMOTE_MODE=read-only-v1 bash -s -- preflight/);
 assert.match(job,/continue-on-error: true/);
 assert.match(job,/steps\.full_inventory\.outcome/);
 assert.match(job,/if: \$\{\{ always\(\) \}\}/);
 assert.match(job,/gh issue comment 208/);
 assert.match(job,/PRODUCTION_GATE=BLOCKED/);
 assert.match(job,/FOUR_COMPONENT_INVENTORY_BLOCKED/);
 assert.doesNotMatch(job,/\bdocker (?:run|exec|compose|load|stop|rm|volume)|\bpsql\b|\bpg_restore\b|\bdropdb\b|\bchown\b|\bchmod\b/);
 assert.doesNotMatch(job,/\bKC_DB_PASSWORD\b|\bPOSTGRES_PASSWORD\b|\bOPENFGA_TOKEN\b|\baccess_token\b/);
});
