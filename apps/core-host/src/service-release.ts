/** Operator-only trusted manifest for the pre-release Service module.
 *
 * Never imported by the Host runtime or exposed over HTTP. The image digest
 * must be verified by the deployment operator against an immutable build.
 * All SQL is read from the installed, reviewed @syndes/service plugin,
 * never from a tenant-supplied filename or database.
 */
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {syndesPlugin} from "@syndes/service/plugin";
import type {TrustedModuleRelease} from "./module-installer.js";

const IMAGE=/^sha256:[0-9a-f]{64}$/;
const sha=(body:string)=>createHash("sha256").update(body,"utf8").digest("hex");
const expected=Object.freeze([
 {id:"001_service_funnels",
  relations:["service.service_funnels","service.service_funnel_stages",
   "service.service_attendances","service.service_attendance_events"]},
 {id:"002_service_team_transfer",
  relations:["service.service_attendances","service.service_attendance_events"]},
 {id:"003_service_conversation_inspector",
  relations:["service.service_attendances","service.service_attendance_events"]},
]);

export async function loadTrustedServiceRelease(
 imageDigest:string,
):Promise<TrustedModuleRelease>{
 if(!IMAGE.test(imageDigest))throw new Error("Verified immutable image digest required");
 if(syndesPlugin.definition.id!=="service"||
    syndesPlugin.definition.version!=="0.3.0"||
    syndesPlugin.migrations.length!==expected.length||
    !syndesPlugin.definition.dependencies?.includes("organizations")||
    !syndesPlugin.definition.dependencies?.includes("crm")||
    !syndesPlugin.definition.dependencies?.includes("inbox"))
  throw new Error("Unapproved Service release descriptor");
 const migrations=[];
 for(let i=0;i<expected.length;i++){
  const migration=syndesPlugin.migrations[i],lock=expected[i];
  if(migration.id!==lock.id)throw new Error("Service SQL release manifest changed");
  const sql=await readFile(new URL(migration.fileUrl),"utf8");
  // No file is selected by an HTTP request or a caller-supplied path.
  migrations.push(Object.freeze({
   id:lock.id,version:"0.3.0",sql,checksum:sha(sql),
   expectedRelations:Object.freeze([...lock.relations]),
  }));
 }
 return Object.freeze({
  id:"service",version:"0.3.0",schema:"service",imageDigest,
  dependencies:Object.freeze(["organizations","crm","inbox"]),
  migrations:Object.freeze(migrations),
 });
}
