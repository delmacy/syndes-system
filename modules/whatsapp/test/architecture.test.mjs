import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(path, import.meta.url),"utf8");
test("official gateway contains original whatsmeow transport",()=>{
 assert.match(read("../gateway/whatsmeow/gateway.go"),/go\.mau\.fi\/whatsmeow/);
 assert.match(read("../gateway/whatsmeow/main.go"),/newHTTPHandler/);
});
test("provider-independent contract does not leak whatsmeow names",()=>{
 assert.doesNotMatch(read("../src/contracts/index.ts"),/whatsmeow|waE2E|types\.JID/);
});
