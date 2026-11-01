import test from "node:test";
import assert from "node:assert/strict";
import {readFile,stat} from "node:fs/promises";
import {join} from "node:path";
const pub=join(process.cwd(),"public");
test("responsive CRM assets are bundled, local and use Keycloak PKCE",async()=>{
 const [html,js,css]=await Promise.all(["crm.html","app.js","styles.css"].map(f=>readFile(join(pub,f),"utf8")));
 assert.match(html,/lang="pt-BR"/);
 assert.match(html,/name="viewport"/);
 assert.match(html,/id="people-list"/);
 assert.match(html,/id="org-list"/);
 assert.match(js,/code_challenge_method:"S256"/);
 assert.match(js,/sessionStorage\.setItem\("syndes\.pkce"/);
 assert.doesNotMatch(js,/localStorage/);
 assert.match(js,/\/duplicates/);
 assert.match(js,/\/imports\/csv/);
 assert.match(css,/@media\(max-width:800px\)/);
 for(const f of ["crm.html","app.js","styles.css"])assert.ok((await stat(join(pub,f))).size>200);
});
