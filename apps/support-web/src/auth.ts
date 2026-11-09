export type SupportConfig=Readonly<{issuer:string;clientId:string;tenantId:string;tenantLabel:string}>;
const pkceKey="syndes.support.pkce",signedOutKey="syndes.support.signedOut";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const callback=()=>window.location.origin+"/";
export function autoLoginAllowed(){return sessionStorage.getItem(signedOutKey)!=="1";}
export function markSignedOut(){sessionStorage.setItem(signedOutKey,"1");sessionStorage.removeItem(pkceKey);}
const b64=(bytes:Uint8Array)=>{
 let str="";for(const byte of bytes)str+=String.fromCharCode(byte);
 return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
export async function readConfig():Promise<SupportConfig>{
 const response=await fetch("/support-runtime.json",{cache:"no-store"});
 if(!response.ok)throw Error("Configuração da Central Syndes indisponível.");
 const value:unknown=await response.json();
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Configuração inválida.");
 const c=value as Partial<SupportConfig>;
 if(typeof c.issuer!=="string"||!c.issuer.startsWith("https://")||
   typeof c.clientId!=="string"||c.clientId!=="syndes-support-ui"||
   !uuid.test(c.tenantId??"")||typeof c.tenantLabel!=="string"||!c.tenantLabel.trim())
   throw Error("Identidade ou tenant Syndes não configurado.");
 return c as SupportConfig;
}
export async function beginLogin(config:SupportConfig){
 sessionStorage.removeItem(signedOutKey);
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
 const state=b64(crypto.getRandomValues(new Uint8Array(24)));
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
 sessionStorage.setItem(pkceKey,JSON.stringify({verifier,state,created:Date.now()}));
 const url=new URL(config.issuer+"/protocol/openid-connect/auth");
 url.search=new URLSearchParams({
  client_id:config.clientId,response_type:"code",scope:"openid",redirect_uri:callback(),
  state,code_challenge:b64(digest),code_challenge_method:"S256"
 }).toString();
 window.location.assign(url.toString());
}
let callbackFlight:Promise<string|null>|undefined;
export function finishLogin(config:SupportConfig):Promise<string|null>{
 if(callbackFlight)return callbackFlight;
 const q=new URLSearchParams(window.location.search);
 if(!q.has("code")&&!q.has("error"))return Promise.resolve(null);
 callbackFlight=exchange(config);
 return callbackFlight;
}
async function exchange(config:SupportConfig):Promise<string|null>{
 const query=new URLSearchParams(window.location.search);
 if(!query.has("code")&&!query.has("error"))return null;
 history.replaceState(null,"",window.location.pathname);
 const saved=sessionStorage.getItem(pkceKey);
 sessionStorage.removeItem(pkceKey);
 if(query.has("error"))throw Error("Acesso recusado pelo Keycloak.");
 if(!saved)throw Error("Sessão de autorização não encontrada.");
 let parsed:unknown;
 try{parsed=JSON.parse(saved);}catch{throw Error("Sessão de autorização inválida.");}
 const p=parsed as {verifier?:unknown;state?:unknown;created?:unknown};
 if(typeof p.verifier!=="string"||typeof p.state!=="string"||p.state!==query.get("state")||
   typeof p.created!=="number"||Date.now()-p.created>5*60_000||Date.now()<p.created)
   throw Error("Validação PKCE inválida ou expirada.");
 const response=await fetch(config.issuer+"/protocol/openid-connect/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"authorization_code",client_id:config.clientId,
   code:query.get("code")??"",redirect_uri:callback(),code_verifier:p.verifier})
 });
 if(!response.ok)throw Error("Falha ao concluir autenticação.");
 const result:unknown=await response.json();
 const token=(result as {access_token?:unknown})?.access_token;
 if(typeof token!=="string"||!token)throw Error("Token de acesso inválido.");
 return token;
}
