import { LayoutDashboard, MessageSquareText, ContactRound, Settings2 } from "lucide-react";
import type { View } from "@/lib/views";

/** Build-time registry of existing tenant features; never a permission grant. */
export const workspaceFeatures = {
  overview: {
    id: "overview", title: "Visão geral", subtitle: "Workspace",
    icon: LayoutDashboard, navigation: true, requiresApi: false,
  },
  inbox: {
    id: "inbox", title: "Inbox", subtitle: "Central de atendimento",
    icon: MessageSquareText, navigation: true, requiresApi: true,
  },
  crm: {
    id: "crm", title: "CRM", subtitle: "Pessoas e empresas",
    icon: ContactRound, navigation: true, requiresApi: true,
  },
  settings: {
    id: "settings", title: "Configurações", subtitle: "Configurações",
    icon: Settings2, navigation: false, requiresApi: false,
  },
} as const satisfies Record<View, {
  id: View; title: string; subtitle: string;
  icon: typeof LayoutDashboard; navigation: boolean; requiresApi: boolean;
}>;

export const primaryNavigation = [
  workspaceFeatures.overview, workspaceFeatures.inbox, workspaceFeatures.crm,
] as const;

export function resolveWorkspaceView(hash: string): View {
  const candidate = hash.startsWith("#") ? hash.slice(1) : hash;
  return Object.hasOwn(workspaceFeatures, candidate) ? candidate as View : "overview";
}

export function viewRequiresApi(view: View): boolean {
  return workspaceFeatures[view].requiresApi;
}
