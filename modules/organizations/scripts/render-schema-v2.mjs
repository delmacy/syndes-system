#!/usr/bin/env node
// OFFLINE compiler only. Never connects to a database and never changes the active manifest.
// A deterministic transitional artifact while AK-10/AK-30 installer gates are absent.
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root=fileURLToPath(new URL("../",import.meta.url));
const sqlDir=path.join(root,"sql");
const outDir=path.join(sqlDir,"schema-v2");
const files=[
 "001_account_hierarchy.sql",
 "002_legacy_single_context_gate.sql",
 "003_legacy_ownership.sql",
 "004_whatsapp_route_owner_guard.sql",
 "005_scoped_relationship_integrity.sql",
 "006_context_creation_audit.sql",
 "007_staff_roles_pre_release.sql",
];
const organizations=[
 "platform_organizations","platform_org_memberships","platform_workspaces",
 "platform_workspace_memberships","platform_units","platform_workspace_units",
 "platform_org_audit","platform_legacy_backfill_runs",
 "platform_staff_identity_links","platform_workspace_staff_roles",
 "platform_staff_teams","platform_staff_team_workspaces",
 "platform_staff_team_members","platform_staff_access_audit",
 "platform_legacy_fill_org_owner","platform_legacy_fill_inbox_owner",
 "platform_backfill_legacy_ownership","platform_validate_whatsapp_route_owner",
 "platform_validate_crm_channel_owner","platform_validate_crm_relationship",
 "platform_validate_inbox_crm_owner","platform_validate_whatsapp_outbox_owner",
 "platform_staff_identity_validate","platform_staff_identity_audit",
 "platform_staff_role_validate","platform_staff_role_audit","platform_staff_audit_guard",
];
const crm=[
 "crm_people","crm_organizations","crm_tags","crm_channel_identities",
 "crm_person_organizations","crm_person_tags","crm_employees",
];
const inbox=["inbox_conversations","inbox_messages"];
const whatsapp=["whatsapp_accounts","whatsapp_conversation_routes","whatsapp_outbox"];
const mappings=new Map([
 ...organizations.map(t=>[t,"organizations."+t]),
 ...crm.map(t=>[t,"crm."+t]),
 ...inbox.map(t=>[t,"inbox."+t]),
 ...whatsapp.map(t=>[t,"whatsapp."+t]),
]);
const quote=(s)=>s.replace(/[.*+?^$\\{}()|[\]\\]/g,"\\$&");
const all=[...mappings.keys()].sort((a,b)=>b.length-a.length).map(quote).join("|");
const identifierPattern=new RegExp("(?<![\\w.])("+all+")(?![\\w])","g");

function compile(file,input){
 // Replace only SQL identifiers outside quoted literals/comments, not column names,
 // constraint/index names, audit event names or TG_TABLE_NAME comparisons.
 let sql=input.replace(/(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*')|([\s\S]*?)(?=(?:--|\/\*|')|$)/g,
  (match,nonSql,code)=>nonSql??code.replace(identifierPattern,name=>mappings.get(name)));
 // Explicit regclass literals must resolve independent of the caller's search_path.
 for(const [name,qualified] of mappings){
  sql=sql.replaceAll("'"+name+"'::regclass","'"+qualified+"'::regclass");
  sql=sql.replaceAll("to_regclass('"+name+"')","to_regclass('"+qualified+"')");
 }
 // The physical 002 gate is in organizations, not the caller's default schema.
 sql=sql.replaceAll("schemaname=current_schema()","schemaname='organizations'");
 if(file.startsWith("007_")){
  sql=sql.replaceAll("table_schema=current_schema()","table_schema='crm'");
  sql=sql.replaceAll("to_regclass('platform_organizations')","to_regclass('organizations.platform_organizations')");
  sql=sql.replaceAll("to_regclass('platform_workspace_memberships')","to_regclass('organizations.platform_workspace_memberships')");
  sql=sql.replaceAll("to_regclass('crm_people')","to_regclass('crm.crm_people')");
  sql=sql.replaceAll("to_regclass('crm_employees')","to_regclass('crm.crm_employees')");
 }
 // Routines must not resolve a user-controlled public/schema shadow object.
 sql=sql.replace(/SET search_path=pg_catalog,public/g,"SET search_path=pg_catalog");
 sql=sql.replace(/LANGUAGE plpgsql( SECURITY INVOKER)?\s+AS/g,
   (m,invoker)=>"LANGUAGE plpgsql"+(invoker??"")+"\nSET search_path=pg_catalog AS");
 // Hardcoded trusted table list, not user input. Trigger name remains legacy-stable.
 if(file.startsWith("003_")){
  const old="AND tgrelid=to_regclass(t)) THEN";
  const newer="AND tgrelid=to_regclass(CASE WHEN t='whatsapp_accounts' THEN 'whatsapp.'||t ELSE 'crm.'||t END)) THEN";
  if(!sql.includes(old))throw Error("Dynamic trigger preflight changed");
  sql=sql.replace(old,newer);
  const re=/EXECUTE format\('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I\s+FOR EACH ROW EXECUTE FUNCTION platform_legacy_fill_org_owner\(\)',\s+t\|\|'_platform_owner_trigger',t\);/;
  if(!re.test(sql))throw Error("Dynamic trigger SQL changed");
  sql=sql.replace(re,`EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I.%I
     FOR EACH ROW EXECUTE FUNCTION organizations.platform_legacy_fill_org_owner()',
       t||'_platform_owner_trigger',
       CASE WHEN t='whatsapp_accounts' THEN 'whatsapp' ELSE 'crm' END,t);`);
 }
 // No reliance on session search_path for migrated identifiers outside string literals.
 const withoutStrings=sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'/g,"");
 if(identifierPattern.test(withoutStrings))throw Error("Unqualified identifier left in "+file);
 identifierPattern.lastIndex=0;
 return `-- CANDIDATE ONLY (AK-40.01). NOT wired into the legacy Host migration manifest.
-- Generated from sql/${file}; do not edit this output by hand.
-- Requires separately installed CRM/Inbox/WhatsApp schemas and approved AK-30 installer.
`+sql;
}
if(process.argv.length!==2 && !(process.argv.length===3&&process.argv[2]==="--check"))
 throw Error("Usage: node scripts/render-schema-v2.mjs [--check]");
const check=process.argv[2]==="--check";
const manifest=[];
for(const file of files){
 const original=await readFile(path.join(sqlDir,file),"utf8");
 const rendered=compile(file,original);
 const dest=path.join(outDir,file);
 if(check){
  if((await readFile(dest,"utf8"))!==rendered)throw Error("Schema V2 artifact stale: "+file);
 }else await writeFile(dest,rendered);
 manifest.push({migration:file,sourceSha256:createHash("sha256").update(original).digest("hex"),
  candidateSha256:createHash("sha256").update(rendered).digest("hex")});
}
const manifestContent=JSON.stringify({kind:"offline-schema-candidate",owner:"organizations",activated:false,
  operationalInstaller:false,files:manifest},null,2)+"\n";
if(check){
 if((await readFile(path.join(outDir,"SOURCE-MANIFEST.json"),"utf8"))!==manifestContent)
  throw Error("Schema V2 source manifest stale");
}else await writeFile(path.join(outDir,"SOURCE-MANIFEST.json"),manifestContent);
process.stdout.write(check?"Schema-v2 artifacts verified (inactive)\n":"Schema-v2 candidate rendered (inactive)\n");
