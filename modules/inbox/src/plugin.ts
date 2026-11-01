import {defineSyndesModule} from "@syndes/core-kernel";
import {inboxModule} from "./service.js";
import {InboxHttpModule} from "./nest.module.js";
export const syndesPlugin=defineSyndesModule({
 definition:inboxModule,
 apiModule:InboxHttpModule,
 publicOidcClientId:"syndes-inbox-ui",
 permissions:[
  {resource:"inbox:conversations",actions:["read","write"]},
  {resource:"inbox:messages",actions:["read","write"]},
  {resource:"inbox:assignments",actions:["write"]},
  {resource:"inbox:handoff",actions:["write"]},
  {resource:"inbox:events",actions:["read"]},
  {resource:"inbox:ingest",actions:["write"]},
 ],
 migrations:[{id:"001_inbox_foundation",fileUrl:new URL("../sql/001_inbox_foundation.sql",import.meta.url).href}],
 assets:[
  {route:"/inbox",fileUrl:new URL("../public/inbox.html",import.meta.url).href,contentType:"text/html; charset=utf-8"},
  {route:"/inbox/app.js",fileUrl:new URL("../public/app.js",import.meta.url).href,contentType:"application/javascript; charset=utf-8"},
  {route:"/inbox/styles.css",fileUrl:new URL("../public/styles.css",import.meta.url).href,contentType:"text/css; charset=utf-8"},
 ],
});
