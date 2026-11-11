import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WorkspaceShell } from "@/app/workspace-shell";
import { useHashView } from "@/app/use-hash-view";
import { useActiveWorkspace } from "@/contexts/use-active-workspace";
import { TenantApi } from "@/lib/api";
import {
  actorFromToken, autoLoginAllowed, beginLogin, finishLogin,
  getWorkspaceConfig, markSignedOut, type WorkspaceConfig,
} from "@/lib/auth";

export default function App() {
  const [view, navigate] = useHashView();
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginError, setLoginError] = useState("");
  const logout = useCallback(() => {
    markSignedOut();
    setToken(null);
    toast.info("Sessão local encerrada.");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const value = await getWorkspaceConfig();
        if (!active) return;
        setConfig(value);
        const jwt = await finishLogin(value);
        if (active && jwt) {
          setToken(jwt);
          toast.success("Autenticado com Keycloak.");
        } else if (active && !jwt && autoLoginAllowed()) {
          // Keycloak is the only entry point: no separate login per module.
          await beginLogin(value);
        }
      } catch (e) {
        if (active) setLoginError(e instanceof Error ? e.message : "Falha ao inicializar.");
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const baseApi = useMemo(
    () => token && config ? new TenantApi(config.tenantId, token, logout) : null,
    [token, config, logout],
  );
  // Logout and principal changes abort the root and all scoped clients during
  // the layout commit, before an old Workspace view can be painted again.
  useLayoutEffect(() => () => baseApi?.dispose(), [baseApi]);
  const { api, activeScopeKey, availableScopes, scopeLoadError, selectScope } =
    useActiveWorkspace(baseApi);

  return <WorkspaceShell
    view={view} navigate={navigate} api={api} actorId={token ? actorFromToken(token) : ""}
    activeScopeKey={activeScopeKey} availableScopes={availableScopes}
    selectScope={selectScope} config={config} token={token}
    initializing={initializing} loginError={loginError} scopeLoadError={scopeLoadError}
    tenantName={config?.tenantLabel || "Minha empresa"} logout={logout}
  />;
}
