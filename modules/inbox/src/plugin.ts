import {defineSyndesModule} from "@syndes/core-kernel";
import {inboxModule} from "./service.js";
import {InboxHttpModule} from "./nest.module.js";
const asset=(route:string,file:string,contentType:string)=>({
 route,fileUrl:new URL("../public/"+file,import.meta.url).href,contentType
});
export const syndesPlugin=defineSyndesModule({
 definition:inboxModule,
 apiModule:InboxHttpModule,
 publicOidcClientId:"syndes-inbox-ui",
 permissions:[
  {resource:"inbox:conversations",actions:["read","write","assign"]},
  {resource:"inbox:messages",actions:["read","reply","simulate"]},
  {resource:"inbox:notes",actions:["write"]},
  {resource:"inbox:metrics",actions:["read"]}
 ],
 migrations:[{id:"001_inbox_foundation",fileUrl:new URL("../sql/001_inbox_foundation.sql",import.meta.url).href}],
 assets:[
  asset("/inbox","inbox.html","text/html; charset=utf-8"),
  asset("/inbox/app.js","app.js","application/javascript; charset=utf-8"),
  asset("/inbox/styles.css","styles.css","text/css; charset=utf-8")
 ]
});
export {InboxController,InboxHost} from "./inbox.controller.js";
