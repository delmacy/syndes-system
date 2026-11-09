import {loadInstalledPlugins} from "./module-host.js";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

/** Operator-only CLI. Prints trusted, installed migrations on stdout.
 * Never accepts a raw filename, SQL text, DSN or tenant identifier. */
async function run():Promise<void>{
  const mods=await loadInstalledPlugins();
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==="--list"){
    process.stdout.write(JSON.stringify(mods.map(p=>({
      id:p.definition.id,
      migrations:p.migrations.map(m=>m.id),
    })))+"\n");
    return;
  }
  if(args.length===3&&args[0]==="--emit"){
    const plugin=mods.find(p=>p.definition.id===args[1]);
    const migration=plugin?.migrations.find(m=>m.id===args[2]);
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
