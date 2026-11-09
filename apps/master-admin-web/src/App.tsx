import {useCallback,useEffect,useMemo,useState} from "react";
import {
 ArrowRight,Building2,Check,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,Clock3,
 Copy,Database,Filter,KeyRound,Layers3,LayoutDashboard,Lock,LogOut,Menu,RefreshCw,
 Search,Shield,ShieldCheck,ShieldOff,Users,UsersRound,X
} from "lucide-react";
import {MasterApi,type Operator,type Overview,type Tenant,type TenantPage} from "./api";
import {clearLogin,finishLogin,login,readConfig,type MasterConfig} from "./auth";

type View="overview"|"clients";
const navigation:{id:View;label:string;icon:typeof LayoutDashboard}[]=[
 {id:"overview",label:"Visão geral",icon:LayoutDashboard},
 {id:"clients",label:"Clientes",icon:Building2},
];
const roleNames:Record<Operator["role"],string>={
 owner:"Proprietário da plataforma",operator:"Operador",viewer:"Consulta"
};
const statusNames:Record<Tenant["status"],string>={
 active:"Ativo",provisioned:"Provisionado",suspended:"Suspenso"
};
const formatDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(value));
function Status({value}:{value:Tenant["status"]}){
 return <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold "+
  (value==="active"?"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100":
  value==="suspended"?"bg-rose-50 text-rose-700 ring-1 ring-rose-100":
  "bg-amber-50 text-amber-700 ring-1 ring-amber-100")}>
  <span className={"size-1.5 rounded-full "+(value==="active"?"bg-emerald-500":value==="suspended"?"bg-rose-500":"bg-amber-500")}/>
  {statusNames[value]}
 </span>;
}
function ClientName({tenant}:{tenant:Tenant}){
 return <div className="flex min-w-0 items-center gap-3">
   <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600"><Building2 className="size-[18px]"/></div>
   <div className="min-w-0">
    <div className="truncate font-semibold text-slate-800">{tenant.displayName??"Cliente sem nome cadastrado"}</div>
    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{tenant.id.slice(0,13)}…</div>
   </div>
 </div>;
}
function Metric({icon:Icon,label,value,hint,accent}:{icon:typeof Users;label:string;value:number|undefined;hint:string;accent:"blue"|"green"|"amber"|"red"}){
 const styles={blue:"bg-blue-50 text-blue-600",green:"bg-emerald-50 text-emerald-600",amber:"bg-amber-50 text-amber-600",red:"bg-rose-50 text-rose-600"};
 return <div className="rounded-[19px] border border-[#e6ebf4] bg-white px-5 py-5 shadow-[0_3px_14px_rgba(33,52,94,0.025)]">
  <div className="flex items-center justify-between">
    <span className="text-[12px] font-medium text-[#70809b]">{label}</span>
    <span className={"flex size-9 items-center justify-center rounded-xl "+styles[accent]}><Icon className="size-[17px]"/></span>
  </div>
  <div className="mt-3 text-[31px] font-bold leading-none tracking-[-0.045em] text-[#182340]">{value===undefined?"—":value.toLocaleString("pt-BR")}</div>
  <p className="mt-2 text-[11px] text-[#97a2b5]">{hint}</p>
 </div>;
}
function TenantTable({items,onSelect,compact=false}:{items:Tenant[];onSelect:(id:string)=>void;compact?:boolean}){
 if(!items.length)return <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
  <div className="rounded-2xl bg-slate-100 p-4 text-slate-400"><Search className="size-6"/></div>
  <h3 className="text-sm font-semibold text-slate-700">Nenhum cliente encontrado</h3>
  <p className="max-w-sm text-xs leading-5 text-slate-500">Ajuste a pesquisa ou aguarde o primeiro tenant registrado no Control Plane.</p>
 </div>;
 return <div className="overflow-x-auto scrollbar-thin">
  <table className="w-full min-w-[620px] text-left">
   <thead><tr className="border-b border-[#edf0f7] bg-[#fafbfe] text-[10px] font-semibold uppercase tracking-[.12em] text-[#8794aa]">
    <th className="px-6 py-4">Cliente</th><th className="px-5 py-4">Situação</th>
    <th className="px-5 py-4">Usuários ativos</th><th className="px-5 py-4">Criado em</th><th className="px-5 py-4 text-right">Abrir</th>
   </tr></thead>
   <tbody>{items.slice(0,compact?5:undefined).map(item=><tr key={item.id} className="group border-b border-[#eef1f6] last:border-b-0 hover:bg-[#f8faff]">
    <td className="px-6 py-4"><ClientName tenant={item}/></td>
    <td className="px-5 py-4"><Status value={item.status}/></td>
    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-700">{item.activeMembers}</td>
    <td className="px-5 py-4 text-[12px] text-slate-500">{formatDate(item.createdAt)}</td>
    <td className="px-5 py-4 text-right"><button type="button" onClick={()=>onSelect(item.id)} aria-label={"Detalhes do cliente "+item.id} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><ArrowRight className="size-4"/></button></td>
   </tr>)}</tbody>
  </table>
 </div>;
}
function ClientDrawer({tenantId,api,onClose}:{tenantId:string;api:MasterApi;onClose:()=>void}){
 const [copied,setCopied]=useState(false);
 const [tenant,setTenant]=useState<Tenant|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  void api.tenant(tenantId,controller.signal).then(detail=>{if(active)setTenant(detail)}).catch(reason=>{
   if(active&&!(reason instanceof DOMException&&reason.name==="AbortError"))
    setError(reason instanceof Error?reason.message:"Falha ao consultar detalhes");
  });
  return()=>{active=false;controller.abort()};
 },[api,tenantId]);
 return <div className="fixed inset-0 z-[60] flex justify-end bg-[#101a32]/40 backdrop-blur-[2px]" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-label="Detalhes do cliente" className="animate-enter flex h-full w-full max-w-[490px] flex-col bg-white shadow-2xl">
   <div className="flex items-center justify-between border-b border-slate-100 px-7 py-6">
    <div><span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8998ae]">Control Plane</span><h2 className="mt-1 text-lg font-bold text-[#17233e]">Detalhes do cliente</h2></div>
    <button type="button" onClick={onClose} aria-label="Fechar detalhes" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="size-5"/></button>
   </div>
   <div className="flex-1 space-y-7 overflow-y-auto px-7 py-7">{tenant ? <>
    <div className="flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Building2 className="size-6"/></div><div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-800">{tenant.displayName??"Cliente sem nome cadastrado"}</h3><div className="mt-2"><Status value={tenant.status}/></div></div></div>
    <div className="rounded-2xl border border-[#e5eaf3] bg-[#f9fbff] p-5">
     <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Identificador técnico do tenant</p>
     <div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-slate-700">{tenant.id}</code><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-white" title="Copiar ID" onClick={()=>void navigator.clipboard.writeText(tenant.id).then(()=>setCopied(true))}>{copied?<Check className="size-4 text-emerald-600"/>:<Copy className="size-4"/>}</button></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
     <div className="rounded-xl border border-slate-100 p-4"><UsersRound className="size-4 text-[#6f84ad]"/><p className="mt-3 text-2xl font-bold text-[#263856]">{tenant.activeMembers}</p><p className="mt-1 text-xs text-slate-500">Membros ativos</p></div>
     <div className="rounded-xl border border-slate-100 p-4"><Clock3 className="size-4 text-[#6f84ad]"/><p className="mt-3 text-[13px] font-bold text-[#263856]">{formatDate(tenant.createdAt)}</p><p className="mt-1 text-xs text-slate-500">Data de criação</p></div>
    </div>
    <div className="space-y-4"><h4 className="text-sm font-bold text-slate-800">Limites administrativos</h4>
     <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><Database className="mt-0.5 size-5 shrink-0 text-blue-600"/><p className="text-xs leading-5 text-[#4d6691]">Este painel consulta apenas o cadastro central. Ele não lê o banco exclusivo do cliente, seus contatos, conversas ou credenciais.</p></div>
     <p className="text-xs leading-5 text-slate-500">Provisionamento de módulos, planos e suspensão serão disponibilizados após os fluxos administrativos auditados serem implementados.</p>
    </div>
   </> : error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : <p role="status" className="text-sm text-slate-600">Carregando detalhes...</p>}</div>
   <div className="border-t border-slate-100 px-7 py-5"><button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Voltar ao diretório</button></div>
  </section>
 </div>;
}
function EmptyOverview({onClients}:{onClients:()=>void}){
 return <div className="rounded-[19px] border border-dashed border-[#d7e0ee] bg-white p-10 text-center"><Building2 className="mx-auto size-8 text-slate-300"/><h3 className="mt-4 font-semibold text-[#243355]">Nenhum cliente cadastrado ainda</h3><p className="mt-2 text-sm text-[#8693a9]">O diretório será preenchido pelos tenants provisionados no Control Plane.</p><button onClick={onClients} className="mt-5 rounded-xl border border-[#dce4f4] px-4 py-2 text-xs font-semibold text-indigo-600">Ver diretório</button></div>;
}
export default function App(){
 const [config,setConfig]=useState<MasterConfig|null>(null);
 const [token,setToken]=useState<string|null>(null);
 const [operator,setOperator]=useState<Operator|null>(null);
 const [booting,setBooting]=useState(true);
 const [authError,setAuthError]=useState("");
 const [view,setView]=useState<View>("overview");
 const [mobileNav,setMobileNav]=useState(false);
 const [summary,setSummary]=useState<Overview|null>(null);
 const [tenants,setTenants]=useState<TenantPage|null>(null);
 const [recentTenants,setRecentTenants]=useState<TenantPage|null>(null);
 const [loadingData,setLoadingData]=useState(false);
 const [query,setQuery]=useState("");
 const [debouncedQuery,setDebouncedQuery]=useState("");
 const [status,setStatus]=useState("all");
 const [page,setPage]=useState(1);
 const [dataError,setDataError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const api=useMemo(()=>token?new MasterApi(token):null,[token]);
 useEffect(()=>{const id=window.setTimeout(()=>setDebouncedQuery(query),350);return()=>window.clearTimeout(id)},[query]);
 useEffect(()=>{let active=true;void(async()=>{
  try{
   const cfg=await readConfig();if(!active)return;
   setConfig(cfg);
   const jwt=await finishLogin(cfg);
   if(active&&jwt)setToken(jwt);
  }catch(error){if(active)setAuthError(error instanceof Error?error.message:"Falha ao iniciar autenticação.")}
  finally{if(active)setBooting(false)}
 })();return()=>{active=false}},[]);
 useEffect(()=>{
  if(!api)return;
  let active=true;const controller=new AbortController();
  api.me(controller.signal).then(result=>{if(active){setOperator(result);setAuthError("")}}).catch(error=>{
   if(active&&!(error instanceof DOMException&&error.name==="AbortError")){
    setOperator(null);setAuthError(error instanceof Error?error.message:"Acesso não autorizado");
   }
  });
  return()=>{active=false;controller.abort()};
 },[api]);
 useEffect(()=>{
  if(!api||!operator)return;
  let active=true;const controller=new AbortController();
  setLoadingData(true);
  void Promise.all([api.overview(controller.signal),api.tenants({query:debouncedQuery,state:status,page},controller.signal),api.tenants({query:"",state:"all",page:1},controller.signal)])
   .then(([totals,listing,recent])=>{if(active){setSummary(totals);setTenants(listing);setRecentTenants(recent);setDataError("")}})
   .catch(error=>{
    if(active&&!(error instanceof DOMException&&error.name==="AbortError"))
     setDataError(error instanceof Error?error.message:"Control Plane indisponível");
   }).finally(()=>{if(active)setLoadingData(false)});
  return()=>{active=false;controller.abort()};
 },[api,operator,debouncedQuery,status,page,refresh]);
 const switchView=useCallback((next:View)=>{setView(next);setMobileNav(false)},[]);
 const signOut=()=>{
  clearLogin();setToken(null);setOperator(null);setSummary(null);setTenants(null);setRecentTenants(null);setAuthError("");setSelected(null);
  window.history.replaceState(null,"",window.location.origin+"/");
 };
 const renderLogin=()=> <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#101a31] p-5">
  <div className="pointer-events-none absolute -top-32 right-[-10%] size-[650px] rounded-full bg-[#3345a2]/20 blur-[115px]"/>
  <div className="pointer-events-none absolute -bottom-48 left-[-15%] size-[600px] rounded-full bg-[#1f66aa]/15 blur-[110px]"/>
  <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/10 bg-white p-9 shadow-[0_35px_110px_rgba(0,0,0,.25)] sm:p-11">
   <div className="mb-9 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-[#3d5dd1] text-white"><Layers3 className="size-6"/></div><div className="text-2xl font-extrabold tracking-tight text-[#202d4c]">syndes<span className="text-[#506fe0]">.</span><span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-[.17em] text-[#8492a9]">Platform Manager</span></div></div>
   <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#ecf1ff] px-3 py-1.5 text-[11px] font-semibold text-[#4464bd]"><Lock className="size-3.5"/> Acesso reservado à plataforma</div>
   <h1 className="text-3xl font-bold tracking-tight text-[#1e2c4a]">Seu centro de comando.</h1>
   <p className="mt-3 text-sm leading-6 text-[#70809a]">Gerencie a operação do Syndes em um ambiente separado do espaço dos seus clientes.</p>
   {authError&&<div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{authError}</div>}
   <button type="button" disabled={booting||!config} onClick={()=>config&&void login(config).catch(e=>setAuthError(String(e)))}
    className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3c5bcb] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-[#304fc0] disabled:opacity-50">
    <KeyRound className="size-4"/>{booting?"Carregando autenticação…":"Entrar com Keycloak"}<ArrowRight className="size-4"/>
   </button>
   <p className="mt-7 flex items-center justify-center gap-1.5 text-[11px] text-[#91a0b7]"><ShieldCheck className="size-3.5"/> O acesso depende de uma autorização específica do operador</p>
  </div>
 </div>;
 if(!token||!operator)return renderLogin();
 return <div className="flex min-h-dvh bg-[#f6f8fc] text-[#1b2845]">
  {mobileNav&&<button type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-900/45 lg:hidden" onClick={()=>setMobileNav(false)}/>}
  <aside className={"fixed inset-y-0 left-0 z-40 flex w-[254px] flex-col bg-[#111c32] text-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 "+(mobileNav?"translate-x-0":"-translate-x-full")}>
   <div className="flex h-[92px] items-center gap-3 px-7"><span className="flex size-10 items-center justify-center rounded-xl bg-[#4667dd] shadow-lg shadow-indigo-900/30"><Layers3 className="size-[22px]"/></span><div><div className="text-xl font-extrabold tracking-[-.055em]">syndes<span className="text-[#7a9cff]">.</span></div><div className="-mt-0.5 text-[9px] font-semibold uppercase tracking-[.22em] text-[#7588b0]">Syndes Platform Manager</div></div></div>
   <div className="px-4"><div className="rounded-[14px] border border-[#34405b]/70 bg-[#1a2944] p-3.5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0b4d3]"><span className="size-1.5 rounded-full bg-emerald-400"/> Plataforma Syndes</div><p className="mt-1 text-xs text-[#899cbb]">Administração central</p></div></div>
   <nav className="mt-9 flex-1 space-y-1 px-3" aria-label="Navegação do Platform Manager"><div className="mb-3 px-4 text-[10px] font-semibold uppercase tracking-[.19em] text-[#617394]">Gestão da plataforma</div>
    {navigation.map(item=><button type="button" key={item.id} onClick={()=>switchView(item.id)} aria-current={view===item.id?"page":undefined} className={"flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition "+(view===item.id?"bg-[#2c4170] text-white shadow-inner":"text-[#91a1bf] hover:bg-white/5 hover:text-white")}>
     <item.icon className={"size-[18px] "+(view===item.id?"text-[#92b1ff]":"text-[#7486a7]")}/><span className="flex-1 text-[13px] font-semibold">{item.label}</span>{view===item.id&&<span className="size-1.5 rounded-full bg-[#86a6ff]"/>}
    </button>)}
   </nav>
   <div className="border-t border-white/10 px-4 py-4">
    <div className="flex items-center gap-3 rounded-xl px-2 py-2"><div className="flex size-9 items-center justify-center rounded-full bg-[#2a426a] text-xs font-bold text-[#b8caff]"><Shield className="size-4"/></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#e4ecff]">Administrador</p><p className="truncate text-[10px] text-[#8295b6]">{roleNames[operator.role]}</p></div><button type="button" title="Encerrar sessão local" aria-label="Sair" onClick={signOut} className="rounded-lg p-2 text-[#8094ba] hover:bg-white/10 hover:text-white"><LogOut className="size-4"/></button></div>
   </div>
  </aside>
  <div className="min-w-0 flex-1">
   <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b border-[#e5eaf2] bg-white/95 px-5 backdrop-blur lg:px-10">
    <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="Abrir menu" className="rounded-lg p-2 text-slate-600 lg:hidden" onClick={()=>setMobileNav(true)}><Menu className="size-5"/></button><div className="min-w-0"><p className="truncate text-[11px] text-[#91a0b2]">Syndes / Plataforma</p><h2 className="truncate text-sm font-bold text-[#223151]">{navigation.find(x=>x.id===view)?.label}</h2></div></div>
    <div className="flex items-center gap-3"><button type="button" title="Atualizar dados" aria-label="Atualizar dados" className="flex size-9 items-center justify-center rounded-xl border border-[#e2e8f2] text-[#667797] hover:bg-slate-50" onClick={()=>setRefresh(r=>r+1)}><RefreshCw className="size-4"/></button><span className="flex size-9 items-center justify-center rounded-full bg-[#e8edfc] text-[#4865bf]"><ShieldCheck className="size-4"/></span></div>
   </header>
   <main className="mx-auto w-full max-w-[1480px] px-5 pb-14 pt-8 lg:px-10 lg:pt-10">
    {loadingData&&<p role="status" className="mb-4 text-xs text-slate-500">Carregando dados...</p>}
    {dataError&&<div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700"><ShieldOff className="size-4"/><span className="flex-1">{dataError}</span><button onClick={()=>setRefresh(r=>r+1)} className="font-bold underline">Tentar novamente</button></div>}
    {view==="overview"&&<>
     <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#6885bd]"><span className="size-1.5 rounded-full bg-[#5b7bef]"/> Operação central</div><h1 className="text-3xl font-bold tracking-[-.055em] text-[#17233c] sm:text-[35px]">Visão geral da plataforma</h1><p className="mt-2 text-sm text-[#8190a8]">Acompanhe seus clientes sem acessar os dados privados de cada tenant.</p></div><button type="button" onClick={()=>switchView("clients")} className="flex items-center gap-2 rounded-xl bg-[#354fb3] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#273e9e]"><Building2 className="size-4"/> Ver clientes <ArrowRight className="size-4"/></button></div>
     <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5"><Metric icon={Building2} label="Clientes cadastrados" value={summary?.total} hint="Registros no Control Plane" accent="blue"/><Metric icon={CheckCircle2} label="Tenants ativos" value={summary?.active} hint="Com acesso habilitado" accent="green"/><Metric icon={Clock3} label="Aguardando ativação" value={summary?.provisioned} hint="Provisionamento concluído" accent="amber"/><Metric icon={ShieldOff} label="Tenants suspensos" value={summary?.suspended} hint="Acesso operacional suspenso" accent="red"/></div>
     <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)]">
      <section className="overflow-hidden rounded-[20px] border border-[#e5eaf3] bg-white shadow-sm"><div className="flex items-center justify-between px-6 py-6"><div><h2 className="text-sm font-bold text-[#24314e]">Clientes recentes</h2><p className="mt-1 text-xs text-[#95a2b7]">Últimos registros do diretório central</p></div><button type="button" className="flex items-center gap-1 text-xs font-bold text-[#516ec5] hover:text-[#3048a3]" onClick={()=>switchView("clients")}>Ver todos <ArrowRight className="size-3.5"/></button></div>{!recentTenants?<p role="status" className="px-6 py-8 text-xs text-slate-500">Carregando clientes recentes...</p>:recentTenants.items.length?<TenantTable compact items={recentTenants.items} onSelect={setSelected}/>:<EmptyOverview onClients={()=>switchView("clients")}/>}</section>
      <div className="space-y-5">
       <section className="rounded-[20px] border border-[#e5eaf3] bg-white p-5"><div className="flex items-center gap-2"><UsersRound className="size-4 text-[#617cc6]"/><h3 className="text-xs font-bold text-[#263755]">Membros ativos</h3></div><div className="mt-3 flex items-end gap-2"><strong className="text-[28px] font-bold tracking-tight">{summary?.memberships??"—"}</strong><span className="pb-1.5 text-[11px] text-slate-400">vínculos nos tenants</span></div><p className="mt-2 text-[11px] leading-4 text-slate-400">Vínculos ativos, não necessariamente usuários únicos.</p></section>
      </div>
     </div>
    </>}
    {view==="clients"&&<>
     <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#6885bd]">Seu portfólio</div><h1 className="text-[33px] font-bold tracking-[-.05em] text-[#17233c]">Clientes da plataforma</h1><p className="mt-1 text-sm text-[#8291a8]">Um tenant por cliente comercial, com banco de dados dedicado.</p></div>
      <div className="flex items-center gap-2 rounded-xl border border-[#e3eaf5] bg-white px-3 py-2.5 text-xs text-[#7b8ba6]"><Lock className="size-4"/> Cadastro via provisionamento seguro</div>
     </div>
     <section className="overflow-hidden rounded-[20px] border border-[#e5eaf3] bg-white shadow-sm"><div className="flex flex-col justify-between gap-4 border-b border-[#eef1f7] px-6 py-5 md:flex-row md:items-center"><div><h2 className="text-sm font-bold text-[#263856]">Diretório de tenants</h2><p className="mt-1 text-[12px] text-[#97a4b9]">{tenants?.total??"—"} clientes correspondentes</p></div><div className="flex flex-col gap-2 sm:flex-row">
      <label className="flex items-center gap-2 rounded-xl border border-[#dfe6f1] bg-[#fbfcff] px-3 py-2.5 text-slate-400"><Search className="size-4"/><input type="search" value={query} onChange={e=>{setPage(1);setQuery(e.target.value)}} placeholder="Pesquisar nome ou ID..." aria-label="Pesquisar clientes" className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-[#9aa7ba] sm:w-44"/></label>
      <label className="flex items-center gap-2 rounded-xl border border-[#dfe6f1] bg-white px-3 py-2 text-[#8491a6]"><Filter className="size-4"/><select aria-label="Filtrar status" className="bg-transparent text-[12px] font-semibold text-slate-600 outline-none" value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="provisioned">Provisionados</option><option value="suspended">Suspensos</option></select><ChevronDown className="size-3.5"/></label></div></div>
      {tenants?<TenantTable items={tenants.items} onSelect={setSelected}/>:<p role="status" className="px-6 py-8 text-xs text-slate-500">Carregando diretório...</p>}
      <div className="flex items-center justify-between gap-3 border-t border-[#eef1f7] px-6 py-4 text-xs text-slate-500"><span>Página {tenants?.page??1} · {tenants?.total??0} clientes</span><div className="flex gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="size-4"/></button><button type="button" disabled={!tenants||page*tenants.pageSize>=tenants.total} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30" aria-label="Próxima página"><ChevronRight className="size-4"/></button></div></div>
     </section>
    </>}
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e7f0] pt-6 text-[11px] text-[#95a3b8]"><span>© Syndes · Syndes Platform Manager</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5"/> Consultas ao Control Plane</span></footer>
   </main>
  </div>
  {selected&&api&&<ClientDrawer key={selected} tenantId={selected} api={api} onClose={()=>setSelected(null)}/>}
 </div>;
}
