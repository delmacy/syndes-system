import { useEffect, useMemo, useState } from "react";
import { TenantApi, type WorkspaceSelection } from "@/lib/api";

export type AvailableScope = WorkspaceSelection & { label: string; isDefault: boolean };
type ScopeDirectory = Readonly<{
  owner: TenantApi;
  entries: readonly AvailableScope[];
  selection: WorkspaceSelection | null;
  error: string;
}>;

export function scopeKey(selection: WorkspaceSelection | null): string {
  return selection ? selection.organizationId + ":" + selection.workspaceId : "legacy";
}

/** The directory and selection are owned by one exact authenticated API instance.
 * Stale async answers cannot resurrect a prior user or tenant after logout.
 * Legacy single-context compatibility is intentionally preserved until Gate #31.
 */
export function useActiveWorkspace(baseApi: TenantApi | null) {
  const [directory, setDirectory] = useState<ScopeDirectory | null>(null);
  const current = directory?.owner === baseApi ? directory : null;
  const entries = current?.entries ?? [];
  const selection = current?.selection ?? null;
  const scopeLoadError = current?.error ?? "";

  useEffect(() => {
    let live = true;
    // A directory from another owner is already hidden by the source API check.
    if (!baseApi) return;
    void (async () => {
      try {
        const orgs = await baseApi.platformOrganizations();
        const visible = await Promise.all(orgs.map(async org => {
          const workspaces = await baseApi.platformWorkspaces(org.id);
          return workspaces.map(w => ({
            organizationId: org.id, workspaceId: w.id,
            label: (org.display_name || "Organização") + " · " + w.name,
            isDefault: org.is_default && w.is_default,
          }));
        }));
        if (!live) return;
        const results = visible.flat();
        const initial = results.find(x => x.isDefault) ?? results[0];
        setDirectory({
          owner: baseApi, entries: results,
          selection: initial ? { organizationId: initial.organizationId, workspaceId: initial.workspaceId } : null,
          error: "",
        });
      } catch (error) {
        // Legacy installations may not grant directory/read. Do not invent scopes.
        if (live) setDirectory({
          owner: baseApi, entries: [], selection: null,
          error: error instanceof Error ? error.message : "Diretório de organizações indisponível",
        });
      }
    })();
    return () => { live = false; };
  }, [baseApi]);

  const selectScope = (next: WorkspaceSelection) => {
    setDirectory(prev => {
      if (!baseApi || prev?.owner !== baseApi) return prev;
      const allowed = prev.entries.some(x =>
        x.organizationId === next.organizationId && x.workspaceId === next.workspaceId);
      if (!allowed) return prev;
      if (prev.selection?.organizationId === next.organizationId &&
          prev.selection.workspaceId === next.workspaceId) return prev;
      return { ...prev, selection: next };
    });
  };
  const api = useMemo(
    () => baseApi && selection ? baseApi.withScope(selection) : baseApi,
    [baseApi, selection],
  );

  return { api, availableScopes: entries, activeScope: selection, activeScopeKey: scopeKey(selection),
    scopeLoadError, selectScope };
}
