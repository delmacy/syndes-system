import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {webcrypto} from "node:crypto";

const SCRIPT=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const CID="6f5466f6-94e8-49e5-9126-e8ef84864d90";
const FAKE_TOKEN="eyJhbGciOiJub25lIn0."+Buffer.from(JSON.stringify({sub:"agent-1"})).toString("base64url")+".signature";

/** Minimal DOM contract used by Syndes Inbox. No browser process or external DOM package. */
class Element {
  constructor(tag="div"){
    this.tagName=tag.toUpperCase();
    this.children=[];
    this.hidden=false;
    this.value="";
    this.className="";
    this._text="";
    this._classes=new Set();
    this.classList={
      toggle:(name,force)=>{
        const enabled=force??!this._classes.has(name);
        if(enabled)this._classes.add(name);else this._classes.delete(name);
        return enabled;
      },
      contains:name=>this._classes.has(name)
    };
  }
  get textContent(){return this._text+this.children.map(c=>typeof c==="string"?c:c.textContent).join("");}
  set textContent(value){this._text=String(value);this.children=[];}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;this._text="";}
}

function makeHarness({loggedIn=true,tenantId=A,initialSubject="Pedido <script>alert(1)</script>"}={}){
  const names=["login","logout","identity","tenant","notice","refresh","new","filter",
    "metrics","queue","workspace","empty","subject","context","history","compose",
    "body","reply","note","simulate","assign-me","transfer","pending","resolve","reopen","handoff"];
  const nodes=Object.fromEntries(names.map(n=>[n,new Element()]));
  nodes.tenant.value=tenantId;
  nodes.filter.value="";
  nodes.logout.hidden=true;
  nodes.workspace.hidden=true;
  const prompts=[];
  const calls=[];
  const conversations=new Map();
  const messages=new Map();
  const saved=new Map();
  if(loggedIn)saved.set("syndes.inbox.pkce",JSON.stringify({verifier:"ci-verifier",state:"ci-state"}));
  const trace=(action,details={})=>{
    calls.push({action,...details});
  };
  const response=(data,status=200)=>({
    ok:status>=200&&status<300,status,
    async json(){return data;}
  });
  const fetchMock=async(url,options={})=>{
    const method=options.method??"GET";
    if(url==="/modules/inbox/config"){
      trace("config",{status:200});return response({issuer:"https://identity.example.invalid",clientId:"ci-inbox"});
    }
    if(url==="https://identity.example.invalid/protocol/openid-connect/token"){
      trace("oidc-token",{status:200});return response({access_token:FAKE_TOKEN});
    }
    const parsed=new URL(url,"http://syndes.test");
    const prefix="/v1/tenants/"+tenantId+"/inbox";
    const relative=parsed.pathname.startsWith(prefix)?parsed.pathname.slice(prefix.length):null;
    const data=options.body?JSON.parse(options.body):null;
    if(relative===null){trace("http",{method,path:parsed.pathname,status:404});return response({message:"Unknown route"},404);}
    if(tenantId===B){
      trace("http",{method,path:relative,status:403});return response({message:"Forbidden"},403);
    }
    if(options.headers?.Authorization!=="Bearer "+FAKE_TOKEN){
      trace("http",{method,path:relative,status:401});return response({message:"Unauthorized"},401);
    }
    let result,status=200;
    const parts=relative.split("/").filter(Boolean);
    const c=parts[0]==="conversations"?conversations.get(parts[1]):undefined;
    if(relative==="/conversations"&&method==="POST"){
      status=201;
      result={id:CID,tenantId,subject:data.subject,crmPersonId:data.crmPersonId,
        channel:"simulation",status:"open",handoff:"human",assignedTo:null};
      conversations.set(CID,result);
      messages.set(CID,[]);
    }else if(relative==="/conversations"&&method==="GET"){
      const statusFilter=parsed.searchParams.get("status");
      result=[...conversations.values()].filter(x=>!statusFilter||x.status===statusFilter);
    }else if(relative==="/metrics"&&method==="GET"){
      const all=[...conversations.values()];
      result={open:all.filter(x=>x.status==="open").length,
        pending:all.filter(x=>x.status==="pending").length,
        resolved:all.filter(x=>x.status==="resolved").length,
        unassigned:all.filter(x=>!x.assignedTo).length};
    }else if(parts[0]==="conversations"&&c){
      if(parts.length===2&&method==="GET")result={...c};
      else if(parts[2]==="messages"&&method==="GET")result=[...messages.get(c.id)];
      else if(parts[2]==="assignment"&&method==="PATCH"){
        c.assignedTo=data.assigneeId;result={...c};
      }else if(parts[2]==="status"&&method==="PATCH"){
        c.status=data.status;result={...c};
      }else if(parts[2]==="handoff"&&method==="PATCH"){
        c.handoff=data.mode;result={...c};
      }else if(method==="POST"&&(["replies","notes"].includes(parts[2])||
        (parts[2]==="simulator"&&parts[3]==="inbound"))){
        const direction=parts[2]==="replies"?"outbound":parts[2]==="notes"?"internal":"inbound";
        if(direction==="outbound"&&(!c.assignedTo||c.status==="resolved")){
          status=404;result={message:"Conversation not assigned or resolved"};
        }else{
          const item={id:"m-"+(messages.get(c.id).length+1),conversationId:c.id,tenantId,
            direction,body:data.body,authorId:direction==="inbound"?"simulator":"agent-1",
            createdAt:"2026-11-01T12:00:00.000Z"};
          messages.get(c.id).push(item);
          if(direction==="inbound"&&c.status==="resolved")c.status="open";
          result=item;
        }
      }
    }
    if(result===undefined){
      status=404;result={message:"Not found"};
    }
    trace("http",{method,path:relative,status,body:method==="GET"?undefined:
      data==null?undefined:Object.keys(data)});
    return response(result,status);
  };
  const sessionStorage={
    getItem:key=>saved.get(key)??null,
    setItem:(key,val)=>saved.set(key,val),
    removeItem:key=>saved.delete(key)
  };
  const document={
    getElementById:key=>{
      if(!(key in nodes))throw Error("Unexpected document ID: "+key);
      return nodes[key];
    },
    createElement:tag=>new Element(tag),
    visibilityState:"visible"
  };
  const location={origin:"https://syndes.test",search:loggedIn?"?code=ci-code&state=ci-state":"",
    assign(){throw Error("Unexpected full-page navigation");}
  };
  runInNewContext(SCRIPT,{
    document,location,history:{replaceState(){}},fetch:fetchMock,
    URL,URLSearchParams,crypto:webcrypto,
    atob,btoa,sessionStorage,TextEncoder,
    prompt:()=>prompts.shift()??null,
    setInterval:()=>0,clearInterval:()=>{},
    console:{log:()=>{},error:()=>{}}
  },{filename:"modules/inbox/public/app.js",timeout:1000});
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const until=async(check,message)=>{
    for(let i=0;i<80;i++){
      if(check())return;
      await tick();
    }
    assert.fail(message);
  };
  const activate=async(id)=>{
    assert.equal(typeof nodes[id].onclick,"function","missing click handler for "+id);
    trace("click",{target:id});
    await nodes[id].onclick();
  };
  return {nodes,prompts,calls,saved,conversations,messages,activate,until,initialSubject,trace};
}

test("browserless Inbox: OIDC callback, UI clicks, assignment, replies, notes, status, transfer and handoff",async()=>{
  const h=makeHarness();
  const {nodes,prompts,activate,until,conversations,messages,calls}=h;
  await until(()=>nodes.identity.textContent==="Conectado","OIDC callback did not finish");
  assert.equal(h.saved.has("syndes.inbox.pkce"),false,"PKCE state must be removed");
  prompts.push(h.initialSubject,null);
  await activate("new");
  assert.equal(nodes.subject.textContent,h.initialSubject);
  assert.equal(nodes.queue.children.length,1);
  assert.equal(nodes.queue.children[0].children[0].textContent,h.initialSubject);
  assert.equal(nodes.metrics.textContent.includes("Abertas 1"),true);
  nodes.body.value="Olá do simulador";
  await activate("simulate");
  assert.equal(messages.get(CID)[0].direction,"inbound");
  assert.equal(nodes.history.children.length,1);
  await activate("assign-me");
  assert.equal(conversations.get(CID).assignedTo,"agent-1");
  nodes.body.value="Resposta humana";
  nodes.compose.onsubmit({preventDefault(){h.trace("submit",{target:"compose"})}});
  await until(()=>nodes.notice.textContent==="Resposta registrada.","form submit never completed");
  assert.equal(messages.get(CID)[1].direction,"outbound");
  assert.equal(nodes.body.value,"");
  nodes.body.value="Verificar atendimento";
  await activate("note");
  assert.equal(messages.get(CID)[2].direction,"internal");
  await activate("pending");
  assert.equal(conversations.get(CID).status,"pending");
  await activate("resolve");
  assert.equal(conversations.get(CID).status,"resolved");
  await activate("reopen");
  assert.equal(conversations.get(CID).status,"open");
  prompts.push("agent-2");
  await activate("transfer");
  assert.equal(conversations.get(CID).assignedTo,"agent-2");
  await activate("handoff");
  assert.equal(conversations.get(CID).handoff,"bot");
  await activate("refresh");
  assert.equal(nodes.context.textContent.includes("agent-2"),true);
  assert.equal(nodes.history.children.length,3);
  const unsafe=nodes.history.children[0].children[1];
  assert.equal(unsafe.textContent,"Olá do simulador");
  assert.equal(Object.hasOwn(unsafe,"innerHTML"),false,"UI must render text, not HTML");
  assert.equal(calls.filter(c=>c.action==="http"&&c.status!==200&&c.status!==201).length,0);
  console.log("INBOX_FRONTEND_TRACE "+JSON.stringify(calls));
});

test("browserless Inbox: unauthenticated and foreign-tenant requests fail visibly",async()=>{
  const anonymous=makeHarness({loggedIn:false});
  await anonymous.until(()=>anonymous.nodes.notice.textContent!=="","startup did not finish");
  await anonymous.activate("refresh");
  assert.equal(anonymous.nodes.notice.textContent,"Faça login primeiro");
  assert.equal(anonymous.nodes.notice.classList.contains("error"),true);
  assert.equal(anonymous.calls.some(c=>c.action==="http"),false);

  const foreign=makeHarness({tenantId:B});
  await foreign.until(()=>foreign.nodes.identity.textContent==="Conectado","auth did not finish");
  await foreign.activate("refresh");
  assert.equal(foreign.nodes.notice.textContent,"Forbidden");
  assert.equal(foreign.nodes.queue.children.length,0);
  assert.equal(foreign.calls.find(c=>c.action==="http")?.status,403);
  console.log("INBOX_FRONTEND_DENIAL_TRACE "+JSON.stringify(foreign.calls));
});

test("browserless Inbox: logout clears visible queue and authentication state",async()=>{
  const h=makeHarness();
  await h.until(()=>h.nodes.identity.textContent==="Conectado","auth did not finish");
  h.prompts.push("Conversa privada",null);
  await h.activate("new");
  assert.equal(h.nodes.queue.children.length,1);
  await h.activate("logout");
  assert.equal(h.nodes.login.hidden,false);
  assert.equal(h.nodes.logout.hidden,true);
  assert.equal(h.nodes.queue.children.length,0);
  assert.equal(h.nodes.workspace.hidden,true);
  await h.activate("refresh");
  assert.equal(h.nodes.notice.textContent,"Faça login primeiro");
});
