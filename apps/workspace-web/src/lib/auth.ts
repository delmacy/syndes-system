export type WorkspaceConfig = Readonly<{
  issuer: string;
  clientId: string;
  tenantId: string;
  tenantLabel: string;
}>;

const pendingKey = "syndes.workspace.pkce";
const callbackUri = () => window.location.origin + "/";

function base64url(value: Uint8Array): string {
  let text = "";
  for (const byte of value) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function beginLogin(config: WorkspaceConfig) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem(pendingKey, JSON.stringify({ verifier, state, created: Date.now() }));
  const uri = new URL(config.issuer + "/protocol/openid-connect/auth");
  uri.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid",
    redirect_uri: callbackUri(),
    state,
    code_challenge: base64url(digest),
    code_challenge_method: "S256",
  }).toString();
  window.location.assign(uri.toString());
}

// React StrictMode replays effects in development. Keep the same PKCE exchange
// promise so that an authorization code can never be exchanged twice.
let callbackFlight: Promise<string | null> | undefined;
export function finishLogin(config: WorkspaceConfig): Promise<string | null> {
  if (callbackFlight) return callbackFlight;
  const query = new URLSearchParams(window.location.search);
  if (!query.has("code") && !query.has("error")) return Promise.resolve(null);
  callbackFlight = exchangeCallback(config);
  return callbackFlight;
}

async function exchangeCallback(config: WorkspaceConfig): Promise<string | null> {
  const query = new URLSearchParams(window.location.search);
  if (!query.has("code") && !query.has("error")) return null;
  history.replaceState(null, "", window.location.pathname);
  const entry = sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);
  if (query.has("error")) throw new Error("Login cancelado ou não autorizado pelo Keycloak.");
  if (!entry) throw new Error("Sessão de autenticação não encontrada. Entre novamente.");
  let stored: { verifier: string; state: string; created: number };
  try { stored = JSON.parse(entry) as typeof stored; }
  catch { throw new Error("Sessão OIDC inválida."); }
  if (!stored.state || stored.state !== query.get("state") ||
      !stored.verifier || Date.now() - stored.created > 5 * 60_000)
    throw new Error("Validação OIDC falhou ou expirou.");
  const result = await fetch(config.issuer + "/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code: query.get("code") ?? "",
      redirect_uri: callbackUri(),
      code_verifier: stored.verifier,
    }),
  });
  if (!result.ok) throw new Error("Não foi possível concluir o login no Keycloak.");
  const json: unknown = await result.json();
  const token = (json as { access_token?: unknown })?.access_token;
  if (typeof token !== "string" || !token) throw new Error("Resposta de login inválida.");
  return token;
}

export async function getWorkspaceConfig(): Promise<WorkspaceConfig> {
  const response = await fetch("/workspace-runtime.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Configuração do Workspace indisponível.");
  const config: WorkspaceConfig = await response.json();
  if (!config.clientId || !config.issuer.startsWith("https://") ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.tenantId))
    throw new Error("Configuração de identidade ou tenant inválida.");
  return config;
}

export function actorFromToken(token: string): string {
  try {
    const encoded = token.split(".")[1];
    const json = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" ? json.sub : "";
  } catch { return ""; }
}
