import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import type {INestApplication,Type} from "@nestjs/common";
import {ModuleRegistry,type SyndesPlugin} from "@syndes/core-kernel";

type InstalledConfig={modules:readonly string[]};
const configFile=new URL("../config/modules.json",import.meta.url);

/** Only explicitly approved, installed package names are loaded.
 * This is NOT a runtime marketplace or an untrusted plugin sandbox. */
export async function loadInstalledPlugins():Promise<readonly SyndesPlugin<Type<unknown>>[]>{
  const raw=JSON.parse(await readFile(configFile,"utf8")) as InstalledConfig;
  if(!Array.isArray(raw.modules)||new Set(raw.modules).size!==raw.modules.length)
    throw new Error("Invalid or duplicated installed modules");
  const plugins:SyndesPlugin<Type<unknown>>[]=[];
  for(const specifier of raw.modules){
    if(typeof specifier!=="string"||!/^@syndes\/[a-z][a-z0-9-]*\/plugin$/.test(specifier))
      throw new Error("Only trusted installed Syndes packages are supported");
    const imported=await import(specifier) as {syndesPlugin?:SyndesPlugin};
    const plugin=imported.syndesPlugin;
    if(!plugin||typeof plugin.apiModule!=="function")
      throw new Error("Module missing trusted API descriptor: "+specifier);
    const packageId=specifier.match(/^@syndes\/(.+)\/plugin$/)?.[1];
    if(!packageId||plugin.definition.id!==packageId.replace(/^core-/,""))
      throw new Error("Installed module package ID mismatch");
    plugins.push(plugin as SyndesPlugin<Type<unknown>>);
  }
  // Validate missing dependencies and cycles before starting the application.
  const definitions=[{id:"platform",version:"0.1.0"},...plugins.map(p=>p.definition)];
  new ModuleRegistry(definitions).ordered();
  const urls=plugins.flatMap(p=>p.assets.map(a=>a.route));
  if(new Set(urls).size!==urls.length)throw new Error("Conflicting module asset routes");
  return Object.freeze(plugins);
}

/** Static assets are served only from trusted package-declared exact routes;
 * content cannot be selected by arbitrary user-controlled paths. */
export function installModuleAssets(app:INestApplication,plugins:readonly SyndesPlugin[]):void{
  const assets=new Map(plugins.flatMap(p=>p.assets.map(a=>[a.route,a] as const)));
  // Express middleware adapter; mounted before the Nest HTTP adapter listens.
  app.use(async(req:{
    method:string;originalUrl?:string;
  },res:{
    statusCode:number;
    setHeader(k:string,v:string):void;
    end(body?:string|Buffer):void;
  },next:(error?:unknown)=>void)=>{
    const path=(req.originalUrl??"").split("?")[0];
    const asset=assets.get(path??"");
    if(!asset){next();return}
    if(req.method!=="GET"&&req.method!=="HEAD"){
      res.statusCode=405;res.setHeader("Allow","GET, HEAD");res.end();return;
    }
    try{
      const content=await readFile(fileURLToPath(asset.fileUrl));
      res.setHeader("Content-Type",asset.contentType);
      res.setHeader("X-Content-Type-Options","nosniff");
      res.setHeader("Cache-Control","no-store");
      res.setHeader("Content-Security-Policy",
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https:; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
      res.end(req.method==="HEAD"?undefined:content);
    }catch{res.statusCode=503;res.end("Module asset unavailable")}
  });
}
