#!/usr/bin/env node
/** Unify NestJS singleton classes for local file-linked packages.
 * Registry is build-controlled. This is NOT arbitrary user plugin loading. */
import {readFile,mkdir,rm,symlink,realpath} from "node:fs/promises";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {resolve,dirname,join} from "node:path";
const host=dirname(dirname(fileURLToPath(import.meta.url)));
const require=createRequire(import.meta.url);
const cfg=JSON.parse(await readFile(join(host,"config/modules.json"),"utf8"));
for(const specifier of cfg.modules){
  if(!/^@syndes\/[a-z][a-z0-9-]*\/plugin$/.test(specifier))throw Error("Unexpected installed package");
  const packageRoot=resolve(dirname(fileURLToPath(import.meta.resolve(specifier))),"..");
  const base=join(packageRoot,"node_modules","@nestjs");
  await mkdir(base,{recursive:true});
  for(const name of ["common","core"]){
    const packagePath=require.resolve("@nestjs/"+name+"/package.json");
    const source=dirname(packagePath);
    const dest=join(base,name);
    if(resolve(dest)===resolve(source))continue;
    await rm(dest,{recursive:true,force:true});
    // Windows junctions do not require Developer Mode; POSIX retains directory symlinks.
    await symlink(source,dest,process.platform==="win32"?"junction":"dir");
  }
}
console.log("NestJS peers resolved to one trusted Host installation");
