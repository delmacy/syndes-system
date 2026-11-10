import {existsSync,mkdirSync,rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

// The frontends have separate npm lockfiles and a source-first file: package.
// The package's TypeScript imports resolve from its actual monorepo path.
// Concurrent frontend builds must not run npm ci into the SAME node_modules.
const root=fileURLToPath(new URL("../",import.meta.url));
const lock=join(root,".install-dependencies.lock");
const required=[
 "react/package.json",
 "react-dom/package.json",
 "@types/react/package.json",
 "@base-ui/react/package.json",
 "class-variance-authority/package.json",
 "cn/package.json",
 "typescript/package.json",
];
const ready=()=>required.every(item=>existsSync(join(root,"node_modules",item)));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

if(!ready()){
 let acquired=false;
 const deadline=Date.now()+180_000;
 while(!acquired){
  try{
   mkdirSync(lock);
   acquired=true;
  }catch(error){
   if(error?.code!=="EEXIST")throw error;
   if(Date.now()>=deadline)
    throw Error("Timed out waiting for shared UI npm install. Verify no installer is active before removing "+lock);
   await pause(250);
  }
 }
 try{
  // Recheck after acquiring the lock: another frontend may have installed it.
  if(!ready()){
   const exe=process.platform==="win32"?"npm.cmd":"npm";
   const run=spawnSync(exe,["ci","--no-audit","--no-fund"],{
    cwd:root,stdio:"inherit",shell:process.platform==="win32",
    env:{...process.env,npm_config_audit:"false",npm_config_fund:"false"},
   });
   if(run.error)throw run.error;
   if(run.status!==0)process.exitCode=run.status??1;
   else if(!ready())throw Error("Shared UI dependencies are missing after npm ci");
  }
 }finally{
  rmSync(lock,{recursive:true,force:true});
 }
 if(process.exitCode)process.exit(process.exitCode);
}
