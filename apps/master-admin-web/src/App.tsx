import {useCallback,useEffect,useMemo,useState} from "react";
import {MasterApi,type Operator,type Overview,type TenantPage} from "./api";
import {DemoMasterApi} from "./demo";
import {clearLogin,finishLogin,login,readConfig,type MasterConfig} from "./auth";
import type {View} from "./app/view";
import {ManagerShell} from "./app/ManagerShell";
import {LoginScreen} from "./auth/LoginScreen";
import {OverviewPage} from "./features/overview/OverviewPage";
import {TenantsPage} from "./features/tenants/TenantsPage";
import {ClientDrawer} from "./features/tenants/ClientDrawer";
const previewMode=import.meta.env.VITE_DEMO_PREVIEW==="true";
export default function App(){
 const [config,setConfig]=useState<MasterConfig|null>(null);
 const [token,setToken]=useState<string|null>(previewMode?"VISUAL_PREVIEW_NO_AUTH":null);
 const [operator,setOperator]=useState<Operator|null>(previewMode?{role:"viewer",capabilities:{viewTenants:true,manageTenants:false,viewCustomerData:false}}:null);
 const [booting,setBooting]=useState(!previewMode);
 const [authError,setAuthError]=useState("");
 const [view,setView]=useState<View>("overview");
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
 const api=useMemo(()=>token?(previewMode?new DemoMasterApi():new MasterApi(token)):null,[token]);
 useEffect(()=>{const id=window.setTimeout(()=>setDebouncedQuery(query),350);return()=>window.clearTimeout(id)},[query]);
 useEffect(()=>{if(previewMode)return;let active=true;void(async()=>{
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
 const switchView=useCallback((next:View)=>setView(next),[]);
 const signOut=()=>{
  if(previewMode){setView("overview");setSelected(null);setQuery("");setStatus("all");return;}
  clearLogin();setToken(null);setOperator(null);setSummary(null);setTenants(null);setRecentTenants(null);setAuthError("");setSelected(null);
  window.history.replaceState(null,"",window.location.origin+"/");
 };

 if(!token||!operator)return <LoginScreen booting={booting} config={config} authError={authError}
  onLogin={cfg=>void login(cfg).catch(error=>setAuthError(String(error)))}/>;
 return <>
  <ManagerShell view={view} onViewChange={switchView} onRefresh={()=>setRefresh(r=>r+1)}
   onSignOut={signOut} operator={operator} previewMode={previewMode}
   loadingData={loadingData} dataError={dataError}>
   {view==="overview"&&<OverviewPage summary={summary} recentTenants={recentTenants}
     onClients={()=>switchView("clients")} onSelect={setSelected}/>}
   {view==="clients"&&<TenantsPage tenants={tenants} query={query}
     onQueryChange={value=>{setPage(1);setQuery(value)}} status={status}
     onStatusChange={value=>{setPage(1);setStatus(value)}} page={page}
     setPage={setPage} onSelect={setSelected}/>}
  </ManagerShell>
  {selected&&api&&<ClientDrawer key={selected} tenantId={selected} api={api} onClose={()=>setSelected(null)}/>}
 </>;
}