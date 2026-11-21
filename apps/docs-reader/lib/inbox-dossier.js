import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const ROOT="docs/subprojects/P02-inbox/";
const known=/^p02-[a-z0-9-]+$/;
const get=(path)=>readFileSync(resolve(process.cwd(),"../..",ROOT+path),"utf8");
export function inboxActionCatalog(){
 const parsed=JSON.parse(get("ACOES.json"));
 if(parsed.actions.length!==20||parsed.groups.length!==7)throw Error("P02 catalog drift");
 return parsed;
}
export function parseActionDossier(raw){
 const matches=[...raw.matchAll(/^## ([A-J])[.] ([^\n]+)$/gm)];
 if(matches.length!==10||matches.some((m,i)=>m[1]!=="ABCDEFGHIJ"[i]))throw Error("P02 action dossier A-J drift");
 return matches.map((m,i)=>({letter:m[1],title:m[2].trim(),body:raw.slice(m.index+m[0].length,matches[i+1]?.index??raw.length).trim()}));
}
export function loadInboxAction(id){
 if(!known.test(id))throw Error("Invalid P02 action ID");
 const catalog=inboxActionCatalog();
 const action=catalog.actions.find(a=>a.id===id);
 if(!action)throw Error("Unregistered P02 action "+id);
 const path=ROOT+"acoes/"+id+".md";
 const sections=parseActionDossier(get("acoes/"+id+".md"));
 return {...action,sections,sourcePath:path,sourceUrl:"https://github.com/delmacy/syndes-system/blob/main/"+path,groups:catalog.groups};
}
