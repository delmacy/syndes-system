import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

const workflow=readFileSync(".github/workflows/syndes-core-host-devserver01.yml","utf8");

test("sanitized operational homologation inventory has isolated validation",()=>{
  const result=spawnSync("python3",["scripts/identity/test_homolog_readiness.py"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test("one-shot job runs from approved push main using OIDC Tailnet and read-only script",()=>{
  const job=workflow.split("\n  homolog-readiness:\n")[1];
  assert.ok(job,"Expected mainline-linked homolog-readiness job");
  for(const guard of [
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.actor.login == 'delmacy'",
    "github.event.workflow_run.head_commit.message",
    "tailscale/github-action@v4",
    "HOMOLOG_READINESS_TAILNET_SSH_PASS",
    "scripts/identity/homolog-readiness.py"
  ]) assert.ok(job.includes(guard),guard);
  assert.doesNotMatch(job,/docker (?:run|build|load|restart|compose)/);
});
