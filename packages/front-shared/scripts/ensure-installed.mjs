import {existsSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

// Both frontends have independent lockfiles, but a local file:-linked package
// resolves TypeScript imports from its real path under packages/front-shared.
// Fresh CI clones do not have that package's development node_modules.
// Ensure its dependencies are present WITHOUT reinstalling on every hot reload.
const root=fileURLToPath(new URL("../",import.meta.url));
const required=[
 "react/package.json",
 "react-dom/package.json",
 "@types/react/package.json",
 "@base-ui/react/package.json",
 "class-variance-authority/package.json",
 "cn/package.json",
 "typescript/package.json",
];
const ready=required.every(item=>existsSync(join(root,"node_modules",item)));
if(!ready){
 const exe=process.platform==="win32"?"npm.cmd":"npm";
 const run=spawnSync(exe,["ci","--no-audit","--no-fund"],{
  cwd:root,stdio:"inherit",shell:process.platform==="win32",
  env:{...process.env,npm_config_audit:"false",npm_config_fund:"false"},
 });
 if(run.error)throw run.error;
 if(run.status!==0)process.exit(run.status??1);
 if(!required.every(item=>existsSync(join(root,"node_modules",item))))
  throw Error("Shared UI package dependencies were not installed");
}
