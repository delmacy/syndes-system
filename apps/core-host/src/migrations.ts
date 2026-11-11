import {loadInstalledPlugins} from "./module-host.js";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const PLATFORM_EVENTS={id:"platform_events",migrations:[
 {id:"001_platform_events",fileUrl:new URL("../sql/001_platform_events.sql",import.meta.url).href},
 {id:"002_event_type_version_consistency",fileUrl:new URL("../sql/002_event_type_version_consistency.sql",import.meta.url).href},
]};

/** Operator-only CLI. Prints trusted, installed migrations on stdout.
 * Never accepts a raw filename, SQL text, DSN or tenant identifier. */
async function run():Promise<void>{
  const mods=await loadInstalledPlugins();
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==="--list"){
    process.stdout.write(JSON.stringify([...mods.map(p=>({
      id:p.definition.id,
      migrations:p.migrations.map(m=>m.id),
    })),{id:PLATFORM_EVENTS.id,migrations:PLATFORM_EVENTS.migrations.map(m=>m.id)}])+"\n");
    return;
  }
  if(args.length===3&&args[0]==="--emit"){
    const plugin=mods.find(p=>p.definition.id===args[1]);
    const migrations=args[1]===PLATFORM_EVENTS.id?PLATFORM_EVENTS.migrations:plugin?.migrations;
    const migration=migrations?.find(m=>m.id===args[2]);
    if(!migration)throw new Error("Uninstalled module or unknown migration");
    process.stdout.write(await readFile(fileURLToPath(migration.fileUrl),"utf8"));
    return;
  }
  throw new Error("Usage: migrations --list | --emit <module-id> <migration-id>");
}
run().catch(()=>{
  process.stderr.write("Trusted module migration lookup failed\n");
  process.exitCode=1;
});
