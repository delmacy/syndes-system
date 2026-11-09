import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../../../",import.meta.url);
const read=rel=>readFile(new URL(rel,root),"utf8");

test("Master and Workspace are independent frontend origins, bundles and session storage",async()=>{
 const [main,masterAuth,workspaceAuth,api,nginx,compose,host]=await Promise.all([
  read("apps/master-admin-web/vite.config.ts"),
  read("apps/master-admin-web/src/auth.ts"),
  read("apps/workspace-web/src/lib/auth.ts"),
  read("apps/master-admin-web/src/api.ts"),
  read("apps/master-admin-web/deploy/default.conf"),
  read("infra/master-admin/compose.yaml"),
  read("apps/core-host/src/main.ts")
 ]);
 assert.match(main,/base:"\/"/,"Master is built for independent host root");
 assert.match(masterAuth,/window\.location\.origin\+"\/"/);
 assert.match(masterAuth,/syndes\.master\.pkce/);
 assert.match(workspaceAuth,/syndes\.workspace\.pkce/);
 assert.notEqual(masterAuth.match(/const pending="([^"]+)"/)?.[1],
  workspaceAuth.match(/const pendingKey = "([^"]+)"/)?.[1]);
 assert.match(api,/fetch\("\/v1\/platform\/admin"/);
 assert.doesNotMatch(api,/\/v1\/tenants\//);
 assert.match(nginx,/location \^~ \/v1\/platform\/admin\//);
 assert.match(nginx,/location \^~ \/v1\/ \{ return 404; \}/);
 assert.match(nginx,/location \^~ \/modules\/ \{ return 404; \}/);
 assert.match(nginx,/location = \/workspace-runtime\.json \{ return 404; \}/);
 assert.match(compose,/127\.0\.0\.1:/);
 assert.match(compose,/internal: true/);
 assert.match(compose,/healthcheck:/);
 assert.match(compose,/condition: service_healthy/);
 assert.match(compose,/MASTER_DB_URL_FILE/);
 assert.doesNotMatch(compose,/syndes-core-host-whatsapp/);
 assert.doesNotMatch(compose,/8082/);
 assert.doesNotMatch(host,/PlatformAdminController|PlatformAdminService/);
});
