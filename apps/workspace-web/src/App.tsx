import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, Blocks, CalendarDays, ChartNoAxesCombined,
  CircleHelp, ContactRound, Inbox as InboxIcon,
  LayoutDashboard, LockKeyhole, LogIn, LogOut, MessageSquareText,
  Settings2, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CrmFeature } from "@/features/crm";
import { Overview } from "@/features/overview";
import { SecurityInfo } from "@/features/settings";
import { WhatsAppAccountsFeature } from "@/features/whatsapp-accounts";
import { InboxFeature } from "@/features/inbox";
import { TenantApi } from "@/lib/api";
import { actorFromToken, beginLogin, finishLogin, getWorkspaceConfig, type WorkspaceConfig } from "@/lib/auth";
import type { View } from "@/lib/views";

const moduleNavigation: { id: View; title: string; subtitle: string; icon: typeof InboxIcon }[] = [
  { id: "overview", title: "Visão geral", subtitle: "Workspace", icon: LayoutDashboard },
  { id: "inbox", title: "Inbox", subtitle: "Central de atendimento", icon: MessageSquareText },
  { id: "crm", title: "CRM", subtitle: "Pessoas e empresas", icon: ContactRound },
];
const viewTitles: Record<View, string> = {
  overview: "Visão geral", inbox: "Inbox", crm: "CRM", settings: "Configurações",
};

function useHashView() {
  const decode = (): View => {
    const raw = window.location.hash.replace("#", "");
    return (["overview", "inbox", "crm", "settings"].includes(raw) ? raw : "overview") as View;
  };
  const [view, setView] = useState<View>(decode);
  useEffect(() => {
    const listener = () => setView(decode());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const change = (next: View) => {
    window.location.hash = next;
    setView(next);
  };
  return [view, change] as const;
}

export default function App() {
  const [view, setView] = useHashView();
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginError, setLoginError] = useState("");
  const logout = useCallback(() => { setToken(null); toast.info("Sessão local encerrada."); }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const value = await getWorkspaceConfig();
        if (!active) return;
        setConfig(value);
        const jwt = await finishLogin(value);
        if (active && jwt) { setToken(jwt); toast.success("Autenticado com Keycloak."); }
      } catch (e) { if (active) setLoginError(e instanceof Error ? e.message : "Falha ao inicializar."); }
      finally { if (active) setInitializing(false); }
    })();
    return () => { active = false; };
  }, []);
  const api = useMemo(() => token && config ? new TenantApi(config.tenantId, token, logout) : null, [token, config, logout]);
  const actorId = token ? actorFromToken(token) : "";
  const navigate = (v: View) => setView(v);
  const title = viewTitles[view];
  const tenantName = config?.tenantLabel || "Minha empresa";
  return <TooltipProvider><SidebarProvider defaultOpen>
    <Sidebar collapsible="icon" className="syndes-sidebar border-r-0">
      <SidebarHeader className="px-4 pt-6 pb-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#81a8ff] to-[#4b64e0] shadow-lg shadow-indigo-500/20"><Blocks className="size-6 text-white" /></div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden"><div className="text-[21px] leading-none font-black tracking-[-.7px] text-white">syndes<span className="text-[#86a9ff]">.</span></div><p className="mt-1 text-[10px] font-medium tracking-[.1em] text-[#8695b6] uppercase">Workspace</p></div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-5 px-2 pt-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#7f8cac]">ORGANIZAÇÃO</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="mx-1 flex items-center gap-3 rounded-xl border border-white/10 bg-white/7 px-3 py-3 group-data-[collapsible=icon]:hidden"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#7188d3]/20 text-[#c3d5ff]"><UsersRound className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-white">{tenantName}</strong><small className="block truncate text-[10px] text-[#8395b9]">Ambiente de desenvolvimento</small></span></div>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#7f8cac]">PRINCIPAL</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            {moduleNavigation.map(item => <SidebarMenuItem key={item.id}><SidebarMenuButton onClick={() => navigate(item.id)} isActive={view === item.id} tooltip={item.title} className="nav-module h-11 rounded-xl px-3 text-[#a7b6d3] hover:bg-white/8 hover:text-white data-[active=true]:bg-[#314b8f]/45 data-[active=true]:text-white"><item.icon className="size-4.5" /><span>{item.title}</span>{item.id === "inbox" && <span className="ml-auto size-1.5 rounded-full bg-[#7aa8ff] group-data-[collapsible=icon]:hidden" />}</SidebarMenuButton></SidebarMenuItem>)}
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#7f8cac]">EM BREVE</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            <SidebarMenuItem><SidebarMenuButton disabled tooltip="Agenda ainda não instalada" className="h-10 px-3 text-[#6e7c9b]"><CalendarDays className="size-4" /><span>Agendamentos</span></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton disabled tooltip="Automação ainda não instalada" className="h-10 px-3 text-[#6e7c9b]"><Activity className="size-4" /><span>Automações</span></SidebarMenuButton></SidebarMenuItem>
            <SidebarMenuItem><SidebarMenuButton disabled tooltip="Relatórios ainda não instalados" className="h-10 px-3 text-[#6e7c9b]"><ChartNoAxesCombined className="size-4" /><span>Relatórios</span></SidebarMenuButton></SidebarMenuItem>
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-3 pb-5">
        <SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive={view === "settings"} onClick={() => navigate("settings")} tooltip="Configurações" className="h-10 rounded-xl text-[#a7b6d3] hover:bg-white/8 hover:text-white data-[active=true]:bg-[#314b8f]/45 data-[active=true]:text-white"><Settings2 className="size-4" /><span>Configurações</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
        <div className="flex items-center gap-3 rounded-xl border border-[#354668] bg-[#1b2944] p-3 group-data-[collapsible=icon]:hidden"><ShieldCheck className="size-5 text-[#a6c3ff]" /><span><strong className="block text-xs text-white">Ambiente protegido</strong><small className="text-[10px] text-[#91a1c0]">Identidade e permissões isoladas</small></span></div>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className={view==="inbox"&&api?"h-dvh max-h-dvh min-h-0 min-w-0 overflow-hidden bg-[#f6f8fc]":"min-w-0 bg-[#f6f8fc]"}>
      <header className="sticky top-0 z-10 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-[#e6eaf1] bg-white/95 px-5 backdrop-blur-md lg:px-9">
        <div className="flex items-center gap-3"><SidebarTrigger className="text-slate-500" /><Separator orientation="vertical" className="h-5" /><div className="flex items-center gap-2 text-sm"><span className="hidden text-slate-400 sm:inline">Workspace</span><span className="hidden text-slate-300 sm:inline">/</span><strong className="font-semibold text-slate-800">{title}</strong></div></div>
        <div className="flex items-center gap-3"><Badge variant="outline" className="hidden gap-1.5 rounded-full border-[#dfe8f6] bg-[#f2f6ff] px-3 py-1.5 text-[#5571a8] sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500" /> Desenvolvimento</Badge><Button size="icon-sm" variant="ghost" title="Ajuda e segurança" aria-label="Informações de segurança" onClick={() => navigate("settings")}><CircleHelp className="size-4.5" /></Button><Button size="icon-sm" variant="ghost" title="Notificações serão habilitadas em outro módulo" aria-label="Notificações indisponíveis" disabled><Bell className="size-4.5" /></Button><Separator orientation="vertical" className="h-6" />
          {token ? <><div className="hidden text-right sm:block"><strong className="block text-xs font-semibold text-slate-800">Usuário conectado</strong><small className="text-[10px] text-slate-500">Sessão Keycloak</small></div><Avatar className="size-9"><AvatarFallback className="bg-[#e9efff] text-xs font-bold text-[#395bbc]">SY</AvatarFallback></Avatar><Button variant="ghost" size="icon-sm" title="Sair" aria-label="Sair" onClick={logout}><LogOut className="size-4" /></Button></> :
            <Button size="sm" onClick={() => config && void beginLogin(config)} disabled={!config || initializing} className="gap-1.5"><LogIn className="size-4" /> Entrar</Button>}
        </div>
      </header>
      <div className={view==="inbox"&&api?"min-h-0 flex-1 overflow-hidden p-0":"flex-1 px-5 py-7 lg:px-9 lg:py-9"}>
        <div className={view==="inbox"&&api?"h-full w-full min-h-0":"mx-auto w-full max-w-[1380px]"}>
          {loginError && <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><span>{loginError}</span><Button variant="outline" size="xs" className="ml-auto" onClick={() => window.location.reload()}>Tentar novamente</Button></div>}
          {initializing && <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Sparkles className="mr-2 size-4 animate-pulse" /> Carregando Workspace Syndes...</div>}
          {!initializing && view === "overview" && <Overview api={api} name={tenantName} onNavigate={navigate} />}
          {!initializing && view === "settings" && config && <><SecurityInfo config={config} />{api&&<WhatsAppAccountsFeature api={api} />}</>}
          {!initializing && (view === "crm" || view === "inbox") && !api && <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-[#e3eaf6] bg-white p-10 text-center shadow-sm"><div className="rounded-2xl bg-[#eaf0ff] p-5 text-[#4d6ed3]"><LockKeyhole className="size-8" /></div><h2 className="text-xl font-bold">Acesso protegido</h2><p className="text-sm leading-relaxed text-muted-foreground">Para trabalhar no {title}, autentique-se com sua conta. O Keycloak validará sua identidade e as permissões serão conferidas no servidor.</p><Button size="lg" onClick={() => config && void beginLogin(config)}><LogIn className="size-4" /> Entrar com Keycloak</Button></div>}
          {!initializing && api && view === "crm" && <CrmFeature api={api} />}
          {!initializing && api && view === "inbox" && <InboxFeature api={api} actorId={actorId} onOpenCrm={() => navigate("crm")} />}
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#e6eaf1] bg-white/70 px-5 py-3 text-[11px] text-slate-400 lg:px-9"><span>© Syndes · Workspace</span><span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Controle de acesso pelo Core Host</span></footer>
    </SidebarInset>
    <Toaster richColors position="bottom-right" closeButton />
  </SidebarProvider></TooltipProvider>;
}
