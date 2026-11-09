export type MasterConfig=Readonly<{issuer:string;clientId:string}>;
const pending="syndes.master.pkce";
const redirect=()=>window.location.origin+"/";
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export async function readConfig():Promise<MasterConfig>{
 const r=await fetch("/master-runtime.json",{cache:"no-store"});
 if(!r.ok)throw Error("Configuração do Master Admin não encontrada.");
 const value:unknown=await r.json();
 if(!value||typeof value!=="object")throw Error("Configuração inválida.");
 const {issuer,clientId}=value as Record<string,unknown>;
 if(typeof issuer!=="string"||!issuer.startsWith("https://")||
   typeof clientId!=="string"||!/^[a-zA-Z0-9._-]{3,80}$/.test(clientId))
  throw Error("Identidade OIDC não configurada.");
 return {issuer:issuer.replace(/\/$/,""),clientId};
}
export async function login(cfg:MasterConfig):Promise<void>{
 const verifier=b64url(crypto.getRandomValues(new Uint8Array(32)));
 const state=b64url(crypto.getRandomValues(new Uint8Array(24)));
 const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
 sessionStorage.setItem(pending,JSON.stringify({verifier,state,at:Date.now()}));
 const url=new URL(cfg.issuer+"/protocol/openid-connect/auth");
 url.search=new URLSearchParams({
  client_id:cfg.clientId,response_type:"code",scope:"openid",
  redirect_uri:redirect(),state,code_challenge:b64url(hash),code_challenge_method:"S256"
 }).toString();
 window.location.assign(url.toString());
}
let flight:Promise<string|null>|undefined;
export function finishLogin(cfg:MasterConfig):Promise<string|null>{
 if(flight)return flight;
 const query=new URLSearchParams(window.location.search);
 if(!query.has("code")&&!query.has("error"))return Promise.resolve(null);
 flight=exchange(cfg);
 return flight;
}
async function exchange(cfg:MasterConfig):Promise<string|null>{
 const query=new URLSearchParams(window.location.search);
 const code=query.get("code"),state=query.get("state"),error=query.get("error");
 window.history.replaceState(null,"",redirect());
 const stored=sessionStorage.getItem(pending);
 sessionStorage.removeItem(pending);
 if(error)throw Error("O Keycloak recusou a autenticação.");
 if(!stored||!code||!state)throw Error("Sessão de autenticação ausente.");
 let pkce:{verifier:string;state:string;at:number};
 try {pkce=JSON.parse(stored) as typeof pkce;}catch{throw Error("Sessão inválida.");}
 if(pkce.state!==state||typeof pkce.verifier!=="string"||
  !Number.isFinite(pkce.at)||Date.now()-pkce.at>300000)
  throw Error("Estado da autenticação não corresponde ou expirou.");
 const r=await fetch(cfg.issuer+"/protocol/openid-connect/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"authorization_code",client_id:cfg.clientId,
   code,redirect_uri:redirect(),code_verifier:pkce.verifier}),
  cache:"no-store"
 });
 if(!r.ok)throw Error("Falha ao concluir o login com Keycloak.");
 const value:unknown=await r.json();
 const token=(value as {access_token?:unknown})?.access_token;
 if(typeof token!=="string"||!token)throw Error("Token de sessão inválido.");
 return token;
}
export function clearLogin():void{sessionStorage.removeItem(pending);}
