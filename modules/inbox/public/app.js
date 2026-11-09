"use strict";
const $=key=>document.getElementById(key);
let config,accessToken="",actorId="",selected=null;
const render=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=String(content);if(cls)e.className=cls;return e};
const notice=(message,error=false)=>{$("notice").textContent=message;$("notice").classList.toggle("error",error)};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const tenant=()=>{
 const t=$("tenant").value.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t))throw Error("Informe o UUID válido do tenant.");
 return t;
};
async function auth(){
 if(!config)throw Error("Configuração OIDC indisponível");
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
 const state=b64(crypto.getRandomValues(new Uint8Array(24)));
 sessionStorage.setItem("syndes.inbox.pkce",JSON.stringify({verifier,state}));
 const u=new URL(config.issuer+"/protocol/openid-connect/auth");
 u.search=new URLSearchParams({client_id:config.clientId,response_type:"code",scope:"openid",
  redirect_uri:location.origin+"/inbox",state,code_challenge:challenge,code_challenge_method:"S256"}).toString();
 location.assign(u.toString());
}
async function callback(){
 const query=new URLSearchParams(location.search);if(!query.has("code"))return;
 history.replaceState(null,"","/inbox");
 const stored=sessionStorage.getItem("syndes.inbox.pkce");sessionStorage.removeItem("syndes.inbox.pkce");
 if(!stored)throw Error("Sessão de login expirada");
 const p=JSON.parse(stored);
 if(p.state!==query.get("state"))throw Error("Estado OAuth inválido");
 const response=await fetch(config.issuer+"/protocol/openid-connect/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"authorization_code",client_id:config.clientId,
   redirect_uri:location.origin+"/inbox",code:query.get("code"),code_verifier:p.verifier})});
 if(!response.ok)throw Error("Falha na autenticação");
 const value=await response.json();if(!value.access_token)throw Error("Token OIDC ausente");
 accessToken=value.access_token;
 try{actorId=JSON.parse(atob(accessToken.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub||""}catch{actorId=""}
 $("login").hidden=true;$("logout").hidden=false;$("identity").textContent="Conectado";
 notice("Autenticado. Informe seu tenant e atualize.");
}
async function api(path,method="GET",data){
 if(!accessToken)throw Error("Faça login primeiro");
 const res=await fetch("/v1/tenants/"+tenant()+"/inbox"+path,{
  method,headers:{Authorization:"Bearer "+accessToken,...(data===undefined?{}:{"Content-Type":"application/json"})},
  ...(data===undefined?{}:{body:JSON.stringify(data)})
 });
 if(!res.ok){
  if(res.status===401){accessToken="";$("login").hidden=false;$("logout").hidden=true;}
  const parsed=await res.json().catch(()=>({}));
  throw Error(typeof parsed.message==="string"?parsed.message:"Erro HTTP "+res.status);
 }
 return res.json();
}
const safe=async fn=>{try{await fn()}catch(error){notice(error instanceof Error?error.message:"Erro inesperado",true)}};
const statusLabel={open:"Aberta",pending:"Pendente",resolved:"Resolvida"};
async function refresh(){
 const status=$("filter").value;
 const conversations=await api("/conversations?limit=100"+(status?"&status="+status:""));
 const metrics=await api("/metrics");
 $("metrics").textContent="Abertas "+metrics.open+" · Pendentes "+metrics.pending+" · Resolvidas "+metrics.resolved+" · Sem atendente "+metrics.unassigned;
 const queue=$("queue");queue.replaceChildren();
 if(!conversations.length)queue.append(render("p","Nenhuma conversa na fila.","muted"));
 for(const c of conversations){
  const row=render("button",undefined,"queue-item"+(c.id===selected?.id?" active":""));
  row.type="button";row.append(render("strong",c.subject),render("small",
   statusLabel[c.status]+" · "+(c.assignedTo||"Não atribuída")+" · "+c.channel));
  row.onclick=()=>safe(()=>openConversation(c.id));queue.append(row);
 }
 if(selected){
  const updated=conversations.find(c=>c.id===selected.id);
  if(updated)await openConversation(updated.id,false);
  else{$("workspace").hidden=true;$("empty").hidden=false;selected=null}
 }
}
async function openConversation(key,refreshQueue=true){
 const [c,history]=await Promise.all([api("/conversations/"+key),api("/conversations/"+key+"/messages")]);
 selected=c;$("empty").hidden=true;$("workspace").hidden=false;
 $("subject").textContent=c.subject;
 $("context").textContent="CRM "+(c.crmPersonId||"não vinculado")+" · "+statusLabel[c.status]+" · "+(c.assignedTo||"não atribuída")+" · Handoff "+c.handoff;
 const host=$("history");host.replaceChildren();
 for(const m of history){
  const card=render("article",undefined,"message "+m.direction);
  card.append(render("small",m.direction+" · "+m.authorId+" · "+new Date(m.createdAt).toLocaleString("pt-BR")),
   render("div",m.body));host.append(card);
 }
 host.scrollTop=host.scrollHeight;
 if(refreshQueue)await refresh();
}
async function mutate(path,method,data){
 if(!selected)throw Error("Selecione uma conversa");
 await api("/conversations/"+selected.id+path,method,data);
 await refresh();
}
$("login").onclick=()=>safe(auth);
$("logout").onclick=()=>{
 accessToken="";actorId="";selected=null;$("workspace").hidden=true;$("empty").hidden=false;
 $("queue").replaceChildren();$("metrics").textContent="";
 $("login").hidden=false;$("logout").hidden=true;$("identity").textContent="Não autenticado";
 notice("Sessão local encerrada.");
};
$("refresh").onclick=()=>safe(refresh);$("filter").onchange=()=>safe(refresh);
$("new").onclick=()=>safe(async()=>{
 const subject=prompt("Assunto da conversa simulada:");if(!subject)return;
 const crmPersonId=prompt("UUID do contato CRM (opcional):")||null;
 const c=await api("/conversations","POST",{subject,crmPersonId});
 await openConversation(c.id);notice("Conversa criada.");
});
$("assign-me").onclick=()=>safe(async()=>{if(!actorId)throw Error("Identificador de usuário não disponível");await mutate("/assignment","PATCH",{assigneeId:actorId})});
$("transfer").onclick=()=>safe(async()=>{
 const target=prompt("Identificador do atendente destino:",selected?.assignedTo||"");
 if(target===null)return;
 await mutate("/assignment","PATCH",{assigneeId:target.trim()||null});
});
for(const [key,status] of [["pending","pending"],["resolve","resolved"],["reopen","open"]]){
 $(key).onclick=()=>safe(()=>mutate("/status","PATCH",{status}));
}
$("handoff").onclick=()=>safe(()=>mutate("/handoff","PATCH",{mode:selected.handoff==="human"?"bot":"human"}));
$("compose").onsubmit=e=>{e.preventDefault();safe(async()=>{
 await mutate("/replies","POST",{body:$("body").value});$("body").value="";notice("Resposta registrada.");
})};
$("note").onclick=()=>safe(async()=>{
 await mutate("/notes","POST",{body:$("body").value});$("body").value="";notice("Nota registrada.");
});
$("simulate").onclick=()=>safe(async()=>{
 await mutate("/simulator/inbound","POST",{body:$("body").value,
  externalMessageId:crypto.randomUUID()});$("body").value="";notice("Mensagem simulada recebida.");
});
setInterval(()=>{if(accessToken&&$("tenant").value&&document.visibilityState==="visible")refresh().catch(()=>{})},7000);
(async()=>{try{
 const r=await fetch("/modules/inbox/config");if(!r.ok)throw Error("Configuração do Inbox indisponível");
 config=await r.json();await callback();
}catch(e){notice(e instanceof Error?e.message:"Erro na inicialização",true)}})();
