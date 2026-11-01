"use strict";
const $=id=>document.getElementById(id);
let token="",cfg=null,selected=null,busy=false,cursor=0;
const esc=v=>String(v??"");
function notice(s,error=false){$("notice").textContent=s;$("notice").classList.toggle("error",error)}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=esc(text);if(cls)e.className=cls;return e}
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
async function login(){
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier));
 const state=b64(crypto.getRandomValues(new Uint8Array(24)));
 sessionStorage.setItem("inbox.oauth",JSON.stringify({verifier,state}));
 const url=new URL(cfg.issuer+"/protocol/openid-connect/auth");
 url.search=new URLSearchParams({client_id:cfg.clientId,response_type:"code",redirect_uri:location.origin+"/inbox",
 scope:"openid",state,code_challenge:b64(new Uint8Array(digest)),code_challenge_method:"S256"}).toString();
 location.assign(url);
}
async function callback(){
 const q=new URLSearchParams(location.search);const code=q.get("code");if(!code)return;
 history.replaceState(null,"","/inbox");
 const saved=sessionStorage.getItem("inbox.oauth");sessionStorage.removeItem("inbox.oauth");
 if(!saved)throw Error("Sessão de autenticação expirada");
 const {verifier,state}=JSON.parse(saved);
 if(state!==q.get("state"))throw Error("Estado de autenticação inválido");
 const r=await fetch(cfg.issuer+"/protocol/openid-connect/token",{method:"POST",
 headers:{"Content-Type":"application/x-www-form-urlencoded"},
 body:new URLSearchParams({grant_type:"authorization_code",client_id:cfg.clientId,code,code_verifier:verifier,redirect_uri:location.origin+"/inbox"})});
 if(!r.ok)throw Error("Não foi possível autenticar");
 const body=await r.json();if(!body.access_token)throw Error("Token não recebido");
 token=body.access_token;$("login").hidden=true;$("logout").hidden=false;
 await refresh();
}
async function api(path,method="GET",body){
 if(!token)throw Error("Entre com Keycloak");
 const tenant=$("tenant").value.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenant))throw Error("UUID do tenant inválido");
 const response=await fetch("/v1/tenants/"+tenant+"/inbox"+path,{
 method,headers:{authorization:"Bearer "+token,...(body===undefined?{}:{"Content-Type":"application/json"})},
 ...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){if(response.status===401){token="";$("login").hidden=false;$("logout").hidden=true}
 throw Error("Operação indisponível ("+response.status+")");}
 return response.json();
}
async function safe(fn){try{await fn()}catch(e){notice(e instanceof Error?e.message:"Erro inesperado",true)}}
async function refresh(){
 if(busy||!token)return;busy=true;
 try{
 const list=await api("/conversations?limit=100");
 const host=$("conversations");host.replaceChildren();$("count").textContent=list.length+" conversas";$("conn").textContent="Conectado";
 for(const c of list){
  const btn=node("button",undefined,"conv"+(selected?.id===c.id?" active":""));
  btn.append(node("strong",c.source+" · "+c.externalRef));
  btn.append(node("span",c.status+" · "+(c.assignedTo?"Atribuída":"Não atribuída"),"meta"));
  btn.onclick=()=>safe(()=>open(c));host.append(btn);
 }
 if(selected){const current=list.find(x=>x.id===selected.id);if(current)selected=current;await messages();}
 }finally{busy=false}
}
async function open(c){
 selected=c;$("chat-actions").hidden=false;$("chat-name").textContent=c.externalRef;
 $("chat-sub").textContent=c.source+" · "+(c.assignedTo?"Responsável: "+c.assignedTo:"Sem responsável");
 $("status").value=c.status;$("handoff").textContent=c.humanHandoff?"Encerrar handoff":"Atendimento humano";
 $("claim").textContent=c.assignedTo?"Liberar":"Assumir";
 $("reply").disabled=c.status==="resolved";$("send").disabled=c.status==="resolved";
 await messages();await refresh();
}
async function messages(){
 if(!selected)return;const data=await api("/conversations/"+selected.id+"/messages?limit=100");
 const host=$("messages");host.replaceChildren();
 for(const m of data){
  const bubble=node("div",undefined,"bubble"+(m.direction==="outbound"?" out":""));
  bubble.append(node("div",m.body),node("div",m.direction+" · "+m.delivery+" · "+new Date(m.createdAt).toLocaleString("pt-BR"),"time"));
  host.append(bubble);
 }
 host.scrollTop=host.scrollHeight;
}
$("login").onclick=()=>safe(login);
$("logout").onclick=()=>{token="";selected=null;$("logout").hidden=true;$("login").hidden=false;notice("Sessão local encerrada")};
$("refresh").onclick=()=>safe(refresh);
$("claim").onclick=()=>safe(async()=>{if(!selected)return;selected=await api("/conversations/"+selected.id+"/"+(selected.assignedTo?"release":"claim"),"POST");await open(selected)});
$("status").onchange=()=>safe(async()=>{if(!selected)return;selected=await api("/conversations/"+selected.id+"/status","PATCH",{status:$("status").value});await open(selected)});
$("handoff").onclick=()=>safe(async()=>{if(!selected)return;selected=await api("/conversations/"+selected.id+"/handoff","PATCH",{enabled:!selected.humanHandoff});await open(selected)});
$("compose").onsubmit=e=>{e.preventDefault();safe(async()=>{if(!selected)return;
 const value=$("reply").value.trim();if(!value)return;
 await api("/conversations/"+selected.id+"/replies","POST",{body:value});
 $("reply").value="";notice("Resposta registrada na fila. O envio será feito pelo canal conectado.");await messages();
})};
(async()=>{try{const r=await fetch("/modules/inbox/config");if(!r.ok)throw Error("Configuração indisponível");
 cfg=await r.json();await callback();}catch(e){notice(esc(e.message),true)}})();
// Cursor polling is authorized on every request. No cross-tenant event broadcasts.
setInterval(()=>{if(!token||busy)return;safe(async()=>{const updates=await api("/events?after="+cursor);
 if(updates.length){cursor=updates[updates.length-1].id;await refresh();}})},5000);
