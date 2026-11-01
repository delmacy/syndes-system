"use strict";
const $=id=>document.getElementById(id);
let config=null,token="",tenant="",view="people",selected=null;
const named={people:["Pessoas","Cadastros centralizados com separação por empresa."],
  organizations:["Organizações","Empresas, clientes e vínculos comerciais."],
  tools:["Importar / exportar","Movimentação controlada de contatos em CSV."]};
function notify(message,error=false){const n=$("notice");n.textContent=message;n.classList.toggle("error",error)}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node}
function append(parent,...children){for(const c of children)parent.append(c);return parent}
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
async function login(){
 const codeVerifier=b64(crypto.getRandomValues(new Uint8Array(32)));
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(codeVerifier));
 const state=b64(crypto.getRandomValues(new Uint8Array(24)));
 sessionStorage.setItem("syndes.pkce",JSON.stringify({codeVerifier,state}));
 const target=new URL(config.issuer+"/protocol/openid-connect/auth");
 target.search=new URLSearchParams({client_id:config.clientId,response_type:"code",
   redirect_uri:location.origin+"/crm",scope:"openid",state,
   code_challenge:b64(new Uint8Array(digest)),code_challenge_method:"S256"}).toString();
 location.assign(target.toString());
}
async function callback(){
 const query=new URLSearchParams(location.search);
 const code=query.get("code");if(!code)return;
 history.replaceState(null,"","/crm");
 const stored=sessionStorage.getItem("syndes.pkce");sessionStorage.removeItem("syndes.pkce");
 if(!stored)throw Error("Sessão de login expirada");
 const pkce=JSON.parse(stored);
 if(!pkce.state||query.get("state")!==pkce.state)throw Error("Estado OIDC inválido");
 const res=await fetch(config.issuer+"/protocol/openid-connect/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({grant_type:"authorization_code",client_id:config.clientId,
     code,redirect_uri:location.origin+"/crm",code_verifier:pkce.codeVerifier})});
 if(!res.ok)throw Error("Falha na autenticação Keycloak");
 const response=await res.json();if(!response.access_token)throw Error("Token ausente");
 token=response.access_token;$("logout").hidden=false;$("login").hidden=true;
 $("auth-label").textContent="Sessão autenticada";document.querySelector(".status-dot").classList.add("on");
 notify("Autenticado. Informe o UUID do tenant e atualize o cadastro.");
}
async function api(path,method="GET",body=null,raw=false){
 if(!token)throw Error("Faça login para acessar o CRM.");
 tenant=$("tenant").value.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenant))
   throw Error("Informe um UUID válido da empresa.");
 const url="/v1/tenants/"+encodeURIComponent(tenant)+"/crm"+path;
 const res=await fetch(url,{method,headers:{Authorization:"Bearer "+token,
   ...(body===null?{}:{"Content-Type":"application/json"})},
   ...(body===null?{}:{body:JSON.stringify(body)})});
 if(!res.ok){
   if(res.status===401){token="";$("logout").hidden=true;$("login").hidden=false;}
   const response=await res.json().catch(()=>({}));
   throw Error(typeof response.message==="string"?response.message:"Falha HTTP "+res.status);
 }
 return raw?res.text():res.json();
}
async function safe(fn){try{await fn()}catch(e){notify(e instanceof Error?e.message:"Erro inesperado",true)}}
function switchView(next){
 view=next;selected=null;$("detail").hidden=true;
 for(const key of Object.keys(named))$(key+"-view").hidden=key!==next;
 for(const btn of document.querySelectorAll(".nav"))btn.classList.toggle("active",btn.dataset.view===next);
 $("page-title").textContent=named[next][0];$("subtitle").textContent=named[next][1];
 $("main-actions").hidden=next==="tools";
 safe(refresh);
}
function showList(kind,items){
 const host=$(kind==="people"?"people-list":"org-list");host.replaceChildren();
 if(!items.length){host.append(el("p","Nenhum cadastro encontrado.","empty"));return}
 for(const item of items){
   const row=el("button",undefined,"item");
   const title=kind==="people"?item.name:item.legalName;
   const a=el("span");append(a,el("strong",title),el("small",
     kind==="people"?[item.email,item.phone].filter(Boolean).join(" · "):
       [item.tradeName,item.taxId].filter(Boolean).join(" · ")));
   append(row,a,el("span","›","arrow"));row.onclick=()=>safe(()=>details(kind,item));host.append(row);
 }
}
async function refresh(){
 if(view==="tools")return;
 const kind=view;const q=$(kind==="people"?"people-search":"org-search").value.trim();
 const items=await api("/"+(kind==="people"?"people":"organizations")+"?limit=100&q="+encodeURIComponent(q));
 showList(kind,items);notify(items.length+" cadastro(s) encontrado(s).");
}
function field(name,label,value="",type="text"){
 const wrapper=el("div",undefined,"field");const l=el("label",label);const input=el("input");
 input.name=name;input.value=value??"";input.type=type;
 append(wrapper,l,input);return wrapper;
}
async function edit(kind,item=null){
 const container=$("detail-body");container.replaceChildren();selected=item;
 $("detail").hidden=false;$("detail-title").textContent=item?"Editar cadastro":"Novo cadastro";
 const form=el("form");form.id="crm-form";
 if(kind==="people"){
   append(form,field("name","Nome *",item?.name),field("email","E-mail",item?.email,"email"),
     field("phone","Telefone",item?.phone));
 }else{
   append(form,field("legalName","Razão social *",item?.legalName),
     field("tradeName","Nome fantasia",item?.tradeName),
     field("taxId","CPF/CNPJ",item?.taxId));
 }
 const submit=el("button","Salvar");submit.type="submit";form.append(submit);
 form.onsubmit=e=>{e.preventDefault();safe(async()=>{
   const data=Object.fromEntries(new FormData(form));
   if(kind==="people"&&!item&&(data.email||data.phone)){
     const matches=await api("/duplicates","POST",{email:data.email||null,phone:data.phone||null});
     if(matches.length&&!confirm("Possível duplicidade: "+matches.map(x=>x.name).join(", ")+". Criar mesmo assim?"))return;
   }
   await api("/"+(kind==="people"?"people":"organizations")+(item?"/"+item.id:""),
     item?"PATCH":"POST",data);
   notify("Cadastro salvo.");$("detail").hidden=true;await refresh();
 });};
 container.append(form);$("detail-actions").replaceChildren();
}
async function details(kind,item){
 selected=item;$("detail").hidden=false;$("detail-title").textContent=kind==="people"?item.name:item.legalName;
 const body=$("detail-body"),actions=$("detail-actions");body.replaceChildren();actions.replaceChildren();
 body.append(el("p",kind==="people"?
   [item.email,item.phone].filter(Boolean).join(" · ")||"Sem contato informado":
   [item.tradeName,item.taxId].filter(Boolean).join(" · ")||"Organização"));
 const editButton=el("button","Editar","secondary");editButton.onclick=()=>safe(()=>edit(kind,item));actions.append(editButton);
 const archive=el("button","Arquivar","danger");archive.onclick=()=>safe(async()=>{
   if(!confirm("Arquivar este cadastro?"))return;
   await api("/"+(kind==="people"?"people":"organizations")+"/"+item.id,"DELETE");
   $("detail").hidden=true;await refresh();
 });actions.append(archive);
 if(kind!=="people")return;
 const row=el("div",undefined,"two");
 const note=el("textarea");note.placeholder="Adicionar nota de atendimento";note.rows=3;
 const tag=el("input");tag.placeholder="Nova tag";append(row,note,tag);body.append(row);
 const orgButton=el("button","Vincular organização","secondary");
 orgButton.onclick=()=>safe(async()=>{
   const orgs=await api("/organizations?limit=100");
   if(!orgs.length)throw Error("Crie uma organização antes de vinculá-la.");
   const code=prompt("UUID da organização:\n"+orgs.map(x=>x.legalName+" — "+x.id).join("\n"));
   if(!code)return;
   await api("/people/"+item.id+"/organizations","POST",{organizationId:code.trim()});
   notify("Organização vinculada.");await details("people",item);
 });actions.append(orgButton);
 const empButton=el("button","Cadastrar funcionário","secondary");
 empButton.onclick=()=>safe(async()=>{
   const jobTitle=prompt("Função do funcionário:");
   if(!jobTitle)return;
   await api("/people/"+item.id+"/employee","POST",{jobTitle});
   notify("Funcionário associado à pessoa.");
 });actions.append(empButton);
 const chanButton=el("button","Vincular canal","secondary");
 chanButton.onclick=()=>safe(async()=>{
   const channel=prompt("Canal (whatsapp, instagram ou email):","whatsapp");
   if(!channel)return;
   const externalId=prompt("Identificador externo da conta:");
   if(!externalId)return;
   const displayName=prompt("Nome exibido no canal (não substitui nome do CRM):")||null;
   await api("/people/"+item.id+"/channels","POST",{channel,externalId,displayName});
   notify("Canal vinculado.");await details("people",item);
 });actions.append(chanButton);
 const noteButton=el("button","Adicionar nota","secondary");
 noteButton.onclick=()=>safe(async()=>{
   await api("/people/"+item.id+"/notes","POST",{body:note.value});
   notify("Nota registrada.");await details("people",item);
 });actions.append(noteButton);
 const tagButton=el("button","Adicionar tag","secondary");
 tagButton.onclick=()=>safe(async()=>{
   const created=await api("/tags","POST",{label:tag.value});
   await api("/people/"+item.id+"/tags","POST",{tagId:created.id});
   notify("Tag adicionada.");await details("people",item);
 });actions.append(tagButton);
 const timeline=el("div");append(body,el("h2","Linha do tempo"),timeline);
 const notes=await api("/people/"+item.id+"/notes");
 const notesHost=el("div");append(body,el("h2","Notas"),notesHost);
 for(const n of notes)notesHost.append(el("p",n.body+" · "+new Date(n.createdAt).toLocaleString("pt-BR"),"muted"));
 const channels=await api("/people/"+item.id+"/channels");
 const channelHost=el("div");append(body,el("h2","Identidades de canais"),channelHost);
 for(const ch of channels)channelHost.append(el("p",ch.channel+" · "+ch.externalId+" · "+(ch.displayName??""),"muted"));
 const events=await api("/people/"+item.id+"/timeline");
 if(!events.length)timeline.append(el("p","Sem eventos registrados.","muted"));
 for(const event of events)timeline.append(el("p",event.action+" · "+new Date(event.recordedAt).toLocaleString("pt-BR"),"muted"));
}
$("login").onclick=()=>safe(login);
$("logout").onclick=()=>{
 token="";$("login").hidden=false;$("logout").hidden=true;
 $("auth-label").textContent="Não autenticado";document.querySelector(".status-dot").classList.remove("on");
 notify("Sessão local encerrada. As credenciais não são guardadas no navegador.");
};
$("refresh").onclick=()=>safe(refresh);
$("create").onclick=()=>safe(()=>edit(view));
$("detail-close").onclick=()=>$("detail").hidden=true;
$("search-people").onclick=()=>safe(refresh);$("search-org").onclick=()=>safe(refresh);
$("people-search").onkeydown=e=>{if(e.key==="Enter")safe(refresh)};
$("org-search").onkeydown=e=>{if(e.key==="Enter")safe(refresh)};
for(const b of document.querySelectorAll(".nav"))b.onclick=()=>switchView(b.dataset.view);
$("csv-import").onclick=()=>safe(async()=>{
 const file=$("csv-file").files[0];if(!file)throw Error("Escolha um arquivo CSV.");
 if(file.size>1024*1024)throw Error("Arquivo superior a 1 MiB.");
 const result=await api("/imports/csv","POST",{csv:await file.text()});
 notify(result.imported+" contato(s) importado(s).");
});
$("csv-export").onclick=()=>safe(async()=>{
 const csv=await api("/exports/csv","GET",null,true);
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const anchor=el("a");anchor.href=url;anchor.download="syndes-contacts.csv";anchor.click();
 URL.revokeObjectURL(url);notify("CSV exportado.");
});
(async()=>{
 try{
   const response=await fetch("/crm/config");if(!response.ok)throw Error("Configuração indisponível");
   config=await response.json();
   await callback();
 }catch(e){notify(e instanceof Error?e.message:"Erro ao iniciar CRM",true)}
})();
