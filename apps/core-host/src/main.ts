import "reflect-metadata";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {Controller,Get,Header,Post,Param,Headers,Body,Module,Injectable,Inject,HttpException,HttpStatus,OnModuleDestroy} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {Pool} from "pg";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {registeredModules} from "./modules.js";
import {CrmController,CrmHost} from "./crm.controller.js";
import {TenantPgProvider} from "./tenant-database.js";
import {ActorVerifier,PgMembership,FgaPermission,tenantUUID} from "./adapters.js";
import {loadCoreSecrets,openBaoSourceFromEnv,type CoreRuntimeSecrets} from "./secrets.js";

function env(k:string):string{const v=process.env[k];if(!v?.trim())throw new Error("Missing "+k);return v}
const RUNTIME_SECRETS = "SYNDES_CORE_RUNTIME_SECRETS";

@Injectable()
class CoreService implements OnModuleDestroy{
 readonly db:Pool;
 readonly verifier:ActorVerifier;
 readonly kernel:CoreKernel;
 constructor(@Inject(RUNTIME_SECRETS) credentials:CoreRuntimeSecrets) {
  this.db=new Pool({connectionString:credentials.controlDbUrl,max:5,connectionTimeoutMillis:3000,idleTimeoutMillis:10000});
  this.verifier=new ActorVerifier(env("CORE_KEYCLOAK_ISSUER"),env("CORE_KEYCLOAK_AUDIENCE"),env("CORE_KEYCLOAK_JWKS_URL"));
  this.kernel=new CoreKernel({modules:registeredModules,
   tenancy:new PgMembership(this.db),
   authorization:new FgaPermission(env("CORE_OPENFGA_URL"),env("CORE_OPENFGA_STORE_ID"),credentials.openfgaToken)});
 }
 async ready():Promise<void>{await this.db.query("SELECT 1");await this.kernel.start()}
 async onModuleDestroy():Promise<void>{await this.db.end()}
}

@Controller()
class CoreController{
 constructor(private readonly service:CoreService){}
 @Get("healthz")health(){return {status:"ok"}}
 @Get("crm/config")
 crmConfig(){
  return {issuer:env("CORE_KEYCLOAK_ISSUER"),clientId:process.env.CORE_CRM_PUBLIC_CLIENT_ID??"syndes-crm-ui"};
 }
 @Get("crm")
 @Header("Content-Type","text/html; charset=utf-8")
 @Header("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https:; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
 async crmUi(){return readFile(join(process.cwd(),"public/crm.html"),"utf8")}
 @Get("crm/app.js")
 @Header("Content-Type","application/javascript; charset=utf-8")
 @Header("Cache-Control","no-store")
 async crmJs(){return readFile(join(process.cwd(),"public/app.js"),"utf8")}
 @Get("crm/styles.css")
 @Header("Content-Type","text/css; charset=utf-8")
 async crmCss(){return readFile(join(process.cwd(),"public/styles.css"),"utf8")}
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
@Module({controllers:[CoreController,CrmController],providers:[
  {provide:RUNTIME_SECRETS,useFactory:async()=>loadCoreSecrets(openBaoSourceFromEnv())},
  CoreService,
  {provide:"SYNDES_CORE_API",useExisting:CoreService},
  TenantPgProvider,CrmHost,
]})class AppModule{}
async function bootstrap(){
 const port=Number(process.env.CORE_PORT??"8082");
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("invalid CORE_PORT");
 const app=await NestFactory.create(AppModule,{logger:["error","warn","log"]});
 app.enableShutdownHooks();
 await app.get(CoreService).ready();
 await app.listen(port,"0.0.0.0");
}
bootstrap().catch(()=>{process.stderr.write("Core Host startup failed; verify OpenBao, PostgreSQL and identity configuration\n");process.exitCode=1});
