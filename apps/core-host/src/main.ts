import "reflect-metadata";
import {Controller,Get,Post,Param,Headers,Body,Module,Global,Injectable,Inject,Type,HttpException,HttpStatus,OnModuleDestroy} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {Pool} from "pg";
import {CoreKernel,AccessDeniedError,type ModuleDefinition,type SyndesPlugin} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets} from "./module-host.js";
import {TenantPgProvider} from "./tenant-database.js";
import {ActorVerifier,PgMembership,FgaPermission,tenantUUID} from "./adapters.js";
import {PgModuleCatalog} from "./module-catalog.js";
import {PgModuleLifecycle} from "./module-lifecycle.js";
import {PgEffectiveModuleAccess} from "./module-effective-access.js";
import {crmModuleGateMode,inboxModuleGateMode} from "./module-gate-rollout.js";
import {loadCoreSecrets,openBaoSourceFromEnv,type CoreRuntimeSecrets} from "./secrets.js";

function env(k:string):string{const v=process.env[k];if(!v?.trim())throw new Error("Missing "+k);return v}
const RUNTIME_SECRETS = "SYNDES_CORE_RUNTIME_SECRETS";

@Injectable()
class CoreService implements OnModuleDestroy{
 readonly db:Pool;
 readonly verifier:ActorVerifier;
 readonly kernel:CoreKernel;
 readonly catalog:PgModuleCatalog;
 readonly moduleStates:PgModuleLifecycle;
 readonly crmModuleGateMode:"legacy"|"enforce";
 readonly inboxModuleGateMode:"legacy"|"enforce";
 constructor(@Inject(RUNTIME_SECRETS) credentials:CoreRuntimeSecrets,
             @Inject("SYNDES_MODULE_DEFINITIONS") modules:readonly ModuleDefinition[]) {
  this.crmModuleGateMode=crmModuleGateMode(process.env.SYNDES_CRM_MODULE_GATE);
  this.inboxModuleGateMode=inboxModuleGateMode(process.env.SYNDES_INBOX_MODULE_GATE);
  this.db=new Pool({connectionString:credentials.controlDbUrl,max:5,connectionTimeoutMillis:3000,idleTimeoutMillis:10000});
  this.catalog=new PgModuleCatalog(this.db,modules);
  this.moduleStates=new PgModuleLifecycle(this.db,this.catalog);
  this.verifier=new ActorVerifier(env("CORE_KEYCLOAK_ISSUER"),env("CORE_KEYCLOAK_AUDIENCE"),env("CORE_KEYCLOAK_JWKS_URL"));
  this.kernel=new CoreKernel({modules,
   moduleAccess:new PgEffectiveModuleAccess(this.moduleStates),
   tenancy:new PgMembership(this.db),
   authorization:new FgaPermission(env("CORE_OPENFGA_URL"),env("CORE_OPENFGA_STORE_ID"),credentials.openfgaToken)});
 }
 async ready():Promise<void>{await this.db.query("SELECT 1");await this.kernel.start()}
 async onModuleDestroy():Promise<void>{await this.db.end()}
}

@Controller()
class CoreController{
 constructor(private readonly service:CoreService,
             @Inject("SYNDES_PLUGINS") private readonly plugins:readonly SyndesPlugin<Type<unknown>>[]){}
 @Get("healthz")health(){return {status:"ok"}}
 @Get("modules/:moduleId/config")
 moduleConfig(@Param("moduleId") id:string){
  const mod=this.plugins.find(x=>x.definition.id===id);
  if(!mod?.publicOidcClientId)throw new HttpException("Unknown module",404);
  return {issuer:env("CORE_KEYCLOAK_ISSUER"),clientId:mod.publicOidcClientId};
 }
 @Get("readyz")async ready(){await this.service.ready();return {status:"ready"}}
 @Post("v1/tenants/:tenantId/authorize")
 async check(@Param("tenantId") tenantId:string,@Headers("authorization") header:string|undefined,@Body() body:unknown){
  let actor;
  try{actor=await this.service.verifier.verify(header)}
  catch{throw new HttpException("Unauthorized",HttpStatus.UNAUTHORIZED)}
  if(!tenantUUID(tenantId)||!body||typeof body!=="object"||typeof (body as {action?:unknown}).action!=="string"||typeof (body as {resource?:unknown}).resource!=="string")
   throw new HttpException("Invalid request",HttpStatus.BAD_REQUEST);
  try{
   return await this.service.kernel.execute({actor,tenantId,action:(body as {action:string}).action,resource:(body as {resource:string}).resource},()=>({allowed:true}));
  }catch(e){
   if(e instanceof AccessDeniedError)return {allowed:false};
   throw new HttpException("Authorization unavailable",HttpStatus.SERVICE_UNAVAILABLE);
  }
 }
}
/** Infrastructure is global and exports only the narrowly scoped host ports.
 * Business Nest modules are contributed by trusted, installed packages. */
function createHostModule(plugins:readonly SyndesPlugin<Type<unknown>>[]){
  const definitions:readonly ModuleDefinition[]=Object.freeze([
    {id:"platform",version:"0.1.0"},
    ...plugins.map(p=>p.definition),
  ]);
  @Global()
  @Module({
    providers:[
      {provide:RUNTIME_SECRETS,useFactory:async()=>loadCoreSecrets(openBaoSourceFromEnv())},
      {provide:"SYNDES_MODULE_DEFINITIONS",useValue:definitions},
      {provide:"SYNDES_PLUGINS",useValue:plugins},
      CoreService,
      {provide:"SYNDES_CORE_API",useExisting:CoreService},
      TenantPgProvider,
      {provide:"SYNDES_TENANT_DB",useExisting:TenantPgProvider},
    ],
    exports:[CoreService,"SYNDES_CORE_API","SYNDES_TENANT_DB","SYNDES_PLUGINS"],
  })
  class HostRuntimeModule{}
  @Module({
    imports:[HostRuntimeModule,...plugins.map(p=>p.apiModule)],
    controllers:[CoreController],
  })
  class HostApplicationModule{}
  return HostApplicationModule;
}
async function bootstrap(){
 const port=Number(process.env.CORE_PORT??"8082");
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("invalid CORE_PORT");
 const plugins=await loadInstalledPlugins();
 const app=await NestFactory.create(createHostModule(plugins),{logger:["error","warn","log"]});
 app.enableShutdownHooks();
 await app.get(CoreService).ready();
 installModuleAssets(app,plugins);
 await app.listen(port,"0.0.0.0");
}
bootstrap().catch(()=>{process.stderr.write("Core Host startup failed; verify OpenBao, PostgreSQL and identity configuration\n");process.exitCode=1});
