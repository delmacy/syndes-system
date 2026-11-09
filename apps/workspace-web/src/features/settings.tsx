import { UsersRound, ShieldCheck } from "lucide-react";
import { Badge } from "@syndes/front-shared/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@syndes/front-shared/card";
import { Separator } from "@syndes/front-shared/separator";
import type { WorkspaceConfig } from "@/lib/auth";

export function SecurityInfo({ config }: { config: WorkspaceConfig }) {
  return <section className="space-y-6">
    <div><p className="eyebrow">Seu workspace</p><h1 className="page-title">Configurações</h1><p className="page-subtitle">Informações da organização e do ambiente autenticado.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-[#e7eaf0]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UsersRound className="size-5 text-primary" /> Organização ativa</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm"><p className="font-semibold">{config.tenantLabel}</p><p className="break-all font-mono text-xs text-muted-foreground">{config.tenantId}</p><Separator /><p className="text-muted-foreground">Cada operação utiliza o tenant validado pelo backend. Alterar a URL não concede acesso a outras organizações.</p></CardContent>
      </Card>
      <Card className="border-[#e7eaf0]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-5 text-emerald-600" /> Segurança e identidade</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm"><div className="flex items-center gap-2"><Badge variant="secondary">OIDC + PKCE</Badge><Badge variant="outline">Keycloak</Badge><Badge variant="outline">OpenFGA</Badge></div><p className="text-muted-foreground">O Workspace não possui acesso à API Master. Cada ação é autorizada no servidor, independentemente dos botões exibidos.</p><p className="text-xs text-muted-foreground">A gestão de funcionários e permissões aparecerá aqui quando o módulo correspondente estiver integrado.</p></CardContent>
      </Card>
    </div>
  </section>;
}
