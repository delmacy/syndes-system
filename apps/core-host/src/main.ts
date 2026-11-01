import "reflect-metadata";
import {Controller,Get,Post,Param,Headers,Body,Module,Injectable,HttpException,HttpStatus,OnModuleDestroy} from "@nestjs/common";
import {NestFactory} from "@nestjs/core";
import {Pool} from "pg";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {ActorVerifier,PgMembership,FgaPermission,tenantUUID} from "./adapters.js";

function env(k:string):string{const v=process.env[k];if(!v?.trim())throw new Error("Missing "+k);return v}
@Injectable()
class CoreService implements OnModuleDestroy{
 readonly db=new Pool({connectionString:env("CORE_CONTROL_DB_URL"),max:5,connectionTimeoutMillis:3000,idleTimeoutMillis:10000});
 readonly verifier=new ActorVerifier(env("CORE_KEYCLOAK_ISSUER"),env("CORE_KEYCLOAK_AUDIENCE"),env("CORE_KEYCLOAK_JWKS_URL"));
 readonly kernel=new CoreKernel({modules:[{id:"platform",version:"0.1.0"}],
  tenancy:new PgMembership(this.db),
  authorization:new FgaPermission(env("CORE_OPENFGA_URL"),env("CORE_OPENFGA_STORE_ID"),env("CORE_OPENFGA_TOKEN"))});
 async ready():Promise<void>{await this.db.query("SELECT 1");await this.kernel.start()}
 async onModuleDestroy():Promise<void>{await this.db.end()}
}
@Controller()
class CoreController{
 constructor(private readonly service:CoreService){}
 @Get("healthz")health(){return {status:"ok"}}
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
@Module({controllers:[CoreController],providers:[CoreService]})class AppModule{}
async function bootstrap(){
 const port=Number(process.env.CORE_PORT??"8082");
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error("invalid CORE_PORT");
 const app=await NestFactory.create(AppModule,{logger:["error","warn","log"]});
 app.enableShutdownHooks();
 await app.get(CoreService).ready();
 await app.listen(port,"0.0.0.0");
}
bootstrap().catch(e=>{process.stderr.write("Core Host startup failed: "+String(e)+"\n");process.exitCode=1});
