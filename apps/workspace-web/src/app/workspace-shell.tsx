import type { CSSProperties } from "react";
import {
  Activity, ArrowLeft, Blocks, CalendarDays, ChevronDown, ChartNoAxesCombined,
  CircleHelp, LockKeyhole, LogIn, LogOut, Settings2, ShieldCheck, UsersRound,
} from "lucide-react";
import { Toaster } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@syndes/front-shared/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@syndes/front-shared/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceFeatureOutlet } from "@/app/workspace-feature-outlet";
import { primaryNavigation, workspaceFeatures } from "@/app/feature-registry";
import { beginLogin, type WorkspaceConfig } from "@/lib/auth";
import type { AvailableScope } from "@/contexts/use-active-workspace";
import type { WorkspaceSelection, TenantApi } from "@/lib/api";
import type { View } from "@/lib/views";

export type WorkspaceShellProps = Readonly<{
  view: View;
  navigate: (v: View) => void;
  api: TenantApi | null;
  actorId: string;
  activeScopeKey: string;
  availableScopes: readonly AvailableScope[];
  selectScope: (selection: WorkspaceSelection) => void;
  config: WorkspaceConfig | null;
  token: string | null;
  initializing: boolean;
  loginError: string;
  scopeLoadError: string;
  tenantName: string;
  logout: () => void;
}>;

/** Layout only. Authentication, directory resolution and scope grants live elsewhere. */
export function WorkspaceShell({
  view, navigate, api, actorId, activeScopeKey, availableScopes, selectScope, config,
  token, initializing, loginError, scopeLoadError, tenantName, logout,
}: WorkspaceShellProps) {
  return <TooltipProvider><SidebarProvider defaultOpen style={{"--sidebar-width": view === "inbox" && api ? "21rem" : "16rem"} as CSSProperties}>
    <Sidebar collapsible={view === "inbox" && api ? "offcanvas" : "icon"} className="syndes-sidebar border-r-0">
      <SidebarHeader className={view === "inbox" && api ? "px-3 pt-3 pb-2" : "px-3 pt-5 pb-3"}>
        {view === "inbox" && api
          ? <Button type="button" variant="ghost" className="w-full justify-start gap-2 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("overview")}><ArrowLeft className="size-4"/> Voltar aos módulos</Button>
          : <div className="px-2 text-xs font-medium uppercase tracking-wider text-[#8295ba]">Módulos Syndes</div>}
      </SidebarHeader>
      {view === "inbox" && api ? <SidebarContent className="min-h-0 gap-0 overflow-hidden px-0"><div id="syndes-inbox-sidebar" className="flex h-full min-h-0 flex-col overflow-hidden"/></SidebarContent> : <SidebarContent className="gap-5 px-2 pt-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#7f8cac]">ORGANIZAÇÃO</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="mx-1 flex items-center gap-3 rounded-xl border border-white/10 bg-white/7 px-3 py-3 group-data-[collapsible=icon]:hidden"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#7188d3]/20 text-[#c3d5ff]"><UsersRound className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-white">{tenantName}</strong><small className="block truncate text-[10px] text-[#8395b9]">Ambiente de desenvolvimento</small></span></div>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#7f8cac]">PRINCIPAL</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            {primaryNavigation.map(item => <SidebarMenuItem key={item.id}><SidebarMenuButton onClick={() => navigate(item.id)} isActive={view === item.id} tooltip={item.title} className="nav-module h-11 rounded-xl px-3 text-[#a7b6d3] hover:bg-white/8 hover:text-white data-[active=true]:bg-[#314b8f]/45 data-[active=true]:text-white"><item.icon className="size-4.5" /><span>{item.title}</span>{item.id === "inbox" && <span className="ml-auto size-1.5 rounded-full bg-[#7aa8ff] group-data-[collapsible=icon]:hidden" />}</SidebarMenuButton></SidebarMenuItem>)}
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
      </SidebarContent>}
      <SidebarFooter className="shrink-0 border-t border-white/15 px-3 py-3">
        <div className="flex items-center gap-2 overflow-hidden rounded-xl px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#81a8ff] to-[#4b64e0]"><Blocks className="size-5 text-white"/></span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <strong className="block truncate text-base font-black leading-tight tracking-tight text-white">syndes<span className="text-[#86a9ff]">.</span></strong>
            <small className="block text-[10px] text-[#8ea4c8]">Workspace</small>
          </span>
          <Button type="button" variant="ghost" size="icon-sm" title="Configurações" aria-label="Configurações" onClick={() => navigate("settings")} className="shrink-0 text-[#a7b6d3] hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden"><Settings2 className="size-4"/></Button>
        </div>
        <div className="truncate px-2 text-[10px] text-[#8ea4c8] group-data-[collapsible=icon]:hidden">{tenantName} · Ambiente de desenvolvimento</div>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className={view==="inbox"&&api?"h-dvh max-h-dvh min-h-0 min-w-0 overflow-hidden bg-[#f6f8fc]":"min-w-0 bg-[#f6f8fc]"}>
      <header className={"sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[#e6eaf1] bg-white/95 px-3 backdrop-blur-md lg:px-5 " + (view === "inbox" && api ? "h-14" : "h-[72px]")}>
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="shrink-0 text-slate-500"/>
          <Separator orientation="vertical" className="mx-1 h-5"/>
          {view === "inbox" && api
            ? <div id="syndes-inbox-toolbar" className="flex min-w-0 items-center gap-2"/>
            : <strong className="truncate text-sm font-semibold text-slate-800">{workspaceFeatures[view].title}</strong>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {api&&availableScopes.length>0&&<label className="flex min-w-0 items-center gap-1 text-xs text-slate-600">
            <span className="sr-only">Organização e workspace ativos</span>
            <select aria-label="Organização e workspace ativos"
              className="max-w-44 rounded-lg border border-[#dfe8f6] bg-white px-2 py-1.5 text-xs sm:max-w-64"
              value={activeScopeKey}
              onChange={event=>{
                const choice=availableScopes.find(x=>x.organizationId+":"+x.workspaceId===event.target.value);
                if(choice)selectScope({organizationId:choice.organizationId,workspaceId:choice.workspaceId});
              }}>
              {availableScopes.map(x=><option key={x.organizationId+":"+x.workspaceId}
                value={x.organizationId+":"+x.workspaceId}>{x.label}</option>)}
            </select>
          </label>}
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#dfe8f6] bg-[#f2f6ff] px-2.5 py-1.5 text-xs font-semibold text-[#5571a8] hover:bg-[#e8efff]" aria-label="Ambiente e conta">
              <span className="size-1.5 rounded-full bg-emerald-500"/>
              <span className="hidden sm:inline">Desenvolvimento</span>
              <Avatar className="size-6"><AvatarFallback className="bg-[#dce6ff] text-[10px] font-bold text-[#395bbc]">SY</AvatarFallback></Avatar>
              <ChevronDown className="size-3.5"/>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-[#e2e8f3] bg-white p-2 shadow-xl">
              <p className="px-2 py-2 text-xs font-semibold text-slate-800">{token ? "Sessão Keycloak ativa" : "Acesso à Syndes"}</p>
              <p className="px-2 pb-2 text-[11px] text-slate-500">Ambiente de desenvolvimento</p>
              <Separator className="my-1"/>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("settings")}><Settings2 className="size-4"/> Configurações</Button>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("settings")}><CircleHelp className="size-4"/> Ajuda e segurança</Button>
              {token
                ? <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2 text-rose-700" title="Sair" aria-label="Sair" onClick={logout}><LogOut className="size-4"/> Sair</Button>
                : <Button type="button" size="sm" className="w-full" onClick={() => config && void beginLogin(config)} disabled={!config || initializing}><LogIn className="size-4"/> Entrar</Button>}
            </div>
          </details>
        </div>
      </header>
      <div className={view==="inbox"&&api?"min-h-0 flex-1 overflow-hidden p-0":"flex-1 px-5 py-7 lg:px-9 lg:py-9"}>
        <div className={view==="inbox"&&api?"h-full w-full min-h-0":"mx-auto w-full max-w-[1380px]"}>
          {(loginError||scopeLoadError) && <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><span>{loginError||scopeLoadError}</span><Button variant="outline" size="xs" className="ml-auto" onClick={() => window.location.reload()}>Tentar novamente</Button></div>}
          <WorkspaceFeatureOutlet view={view} api={api} config={config} actorId={actorId}
            tenantName={tenantName} scopeKey={activeScopeKey} navigate={navigate}
            initializing={initializing} beginLogin={() => { if(config) void beginLogin(config); }} />
        </div>
      </div>
      <footer className={(view === "inbox" ? "hidden " : "flex ") + "shrink-0 items-center justify-between gap-4 border-t border-[#e6eaf1] bg-white/70 px-5 py-3 text-[11px] text-slate-400 lg:px-9"}><span>© Syndes · Workspace</span><span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Controle de acesso pelo Core Host</span></footer>
    </SidebarInset>
    <Toaster richColors position="bottom-right" closeButton />
  </SidebarProvider></TooltipProvider>;
}
