import type { ReactNode } from "react";
import { LockKeyhole, LogIn, Sparkles } from "lucide-react";
import { Button } from "@syndes/front-shared/button";
import { CrmFeature } from "@/features/crm";
import { Overview } from "@/features/overview";
import { SecurityInfo } from "@/features/settings";
import { WhatsAppAccountsFeature } from "@/features/whatsapp-accounts";
import { InboxFeature } from "@/features/inbox";
import type { TenantApi } from "@/lib/api";
import type { WorkspaceConfig } from "@/lib/auth";
import type { View } from "@/lib/views";
import { viewRequiresApi } from "@/app/feature-registry";

export type FeatureContext = Readonly<{
  api: TenantApi | null;
  config: WorkspaceConfig | null;
  tenantName: string;
  actorId: string;
  scopeKey: string;
  navigate: (view: View) => void;
}>;

/** Renderers are selected only from the fixed feature registry. */
const renderers: Record<View, (props: FeatureContext) => ReactNode> = {
  overview: ({ api, tenantName, navigate }) =>
    <Overview api={api} name={tenantName} onNavigate={navigate} />,
  settings: ({ api, config, scopeKey }) =>
    config && <><SecurityInfo config={config} />{api && <WhatsAppAccountsFeature key={scopeKey} api={api} />}</>,
  crm: ({ api, scopeKey }) => api && <CrmFeature key={scopeKey} api={api} />,
  inbox: ({ api, scopeKey, actorId, navigate }) => api &&
    <InboxFeature key={scopeKey} api={api} actorId={actorId} onOpenCrm={() => navigate("crm")} />,
};

export function WorkspaceFeatureOutlet(props: FeatureContext & {
  view: View; initializing: boolean; beginLogin: () => void;
}) {
  if (props.initializing) return <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
    <Sparkles className="mr-2 size-4 animate-pulse" /> Carregando Workspace Syndes...
  </div>;
  if (!props.api && viewRequiresApi(props.view)) return <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-[#e3eaf6] bg-white p-10 text-center shadow-sm">
    <div className="rounded-2xl bg-[#eaf0ff] p-5 text-[#4d6ed3]"><LockKeyhole className="size-8" /></div>
    <h2 className="text-xl font-bold">Acesso protegido</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">Uma única autenticação dá acesso aos módulos autorizados do Workspace. As permissões continuam sendo verificadas pelo servidor.</p>
    <Button size="lg" onClick={props.beginLogin}><LogIn className="size-4" /> Entrar com Keycloak</Button>
  </div>;
  return <>{renderers[props.view](props)}</>;
}
