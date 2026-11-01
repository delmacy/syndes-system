import type {ModuleDefinition} from "./module-registry.js";

/** An explicitly installed and trusted package can contribute API/UI/migrations.
 * A module is not an isolated sandbox for arbitrary third-party JavaScript. */
export interface SyndesPlugin<TApi=unknown> {
  readonly definition:ModuleDefinition;
  readonly apiModule:TApi;
  readonly permissions:readonly {readonly resource:string;readonly actions:readonly ("read"|"write")[]}[];
  readonly migrations:readonly {readonly id:string;readonly fileUrl:string}[];
  readonly assets:readonly {readonly route:string;readonly fileUrl:string;readonly contentType:string}[];
  readonly publicOidcClientId?:string;
}

export function defineSyndesModule<TApi>(plugin:SyndesPlugin<TApi>):Readonly<SyndesPlugin<TApi>>{
  const id=plugin.definition.id;
  if(!/^[a-z][a-z0-9.-]*$/.test(id)||!plugin.apiModule)
    throw new Error("Invalid trusted module descriptor");
  const unique=(strings:readonly string[],kind:string)=>{
    if(new Set(strings).size!==strings.length)throw new Error("Duplicate "+kind+" in "+id);
  };
  unique(plugin.migrations.map(x=>x.id),"migration");
  unique(plugin.assets.map(x=>x.route),"asset");
  unique(plugin.permissions.map(x=>x.resource),"permission");
  for(const a of plugin.assets){
    if(!/^\/[a-z][a-z0-9/.-]*$/.test(a.route)||a.route.includes("..")||
       !a.fileUrl.startsWith("file://"))
      throw new Error("Invalid module asset");
  }
  for(const m of plugin.migrations){
    if(!/^\d{3}_[a-z0-9_]+$/.test(m.id)||!m.fileUrl.startsWith("file://"))
      throw new Error("Invalid module migration");
  }
  for(const p of plugin.permissions){
    if(!p.resource.startsWith(id+":")||!p.actions.length||p.actions.some(a=>a!=="read"&&a!=="write"))
      throw new Error("Invalid module resource permission");
  }
  return Object.freeze({
    ...plugin,
    permissions:Object.freeze(plugin.permissions.map(x=>Object.freeze({...x,actions:Object.freeze([...x.actions])}))),
    migrations:Object.freeze(plugin.migrations.map(x=>Object.freeze({...x}))),
    assets:Object.freeze(plugin.assets.map(x=>Object.freeze({...x}))),
  });
}
