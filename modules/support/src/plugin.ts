import {defineSyndesModule} from "@syndes/core-kernel";
import {supportModule} from "./service.js";
import {SupportHttpModule} from "./nest.module.js";
export const syndesPlugin=defineSyndesModule({
 definition:supportModule,
 apiModule:SupportHttpModule,
 permissions:[
  {resource:"support:cases:internal",actions:["read","write"]},
  {resource:"support:cases:external",actions:["read","write"]},
 ],
 migrations:[{id:"001_support_cases",fileUrl:new URL("../sql/001_support_cases.sql",import.meta.url).href}],
 assets:[],
});
export {SupportHost,SupportController} from "./controller.js";
