/**
 * ISOLATED PILOT: Keycloak Authorization Services decision adapter.
 * Not imported by main.ts and not an alternative to current OpenFGA.
 * Callers must verify the user JWT and active tenant/org/workspace
 * against trusted data BEFORE passing any token/context here.
 */
export type KeycloakPilotCapability =
  | "inbox.conversation.read"
  | "inbox.message.send"
  | "inbox.conversation.claim"
  | "inbox.conversation.transfer"
  | "service.funnel.operate";

type ScopedKind = "workspace" | "funnel";
export type TrustedKeycloakPilotContext = Readonly<{
  tenantId: string;
  organizationId: string;
  workspaceId: string;
  kind: ScopedKind;
  funnelId?: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PILOT_SCOPES: Readonly<Record<KeycloakPilotCapability, ScopedKind>> = Object.freeze({
  "inbox.conversation.read": "workspace",
  "inbox.message.send": "workspace",
  "inbox.conversation.claim": "workspace",
  "inbox.conversation.transfer": "workspace",
  "service.funnel.operate": "funnel",
});

/** A registered Keycloak resource MUST have exactly this name; UMA sends its server-issued ID. */
export function pilotResourceName(context: TrustedKeycloakPilotContext): string {
  if (!context || !UUID.test(context.tenantId) || !UUID.test(context.organizationId) ||
      !UUID.test(context.workspaceId)) throw new Error("Invalid trusted authorization context");
  const prefix = "syndes:v1:tenant:" + context.tenantId +
    ":org:" + context.organizationId + ":workspace:" + context.workspaceId;
  if (context.kind === "workspace" && context.funnelId === undefined) return prefix;
  if (context.kind === "funnel" && typeof context.funnelId === "string" &&
      UUID.test(context.funnelId)) return prefix + ":funnel:" + context.funnelId;
  throw new Error("Unsupported resource scope");
}

export class KeycloakUmaAuthorizationPilot {
  private readonly tokenEndpoint: string;
  private readonly audience: string;
  private readonly send: typeof fetch;

  constructor(tokenEndpoint: string, resourceServerClientId: string, send: typeof fetch = fetch) {
    let url: URL;
    try { url = new URL(tokenEndpoint); }
    catch { throw new Error("Invalid Keycloak URL"); }
    const local = url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]");
    if ((url.protocol !== "https:" && !local) || url.username || url.password ||
        url.search || url.hash ||
        !/^\/realms\/[a-zA-Z0-9_-]+\/protocol\/openid-connect\/token$/.test(url.pathname) ||
        !/^[a-z][a-z0-9-]{1,80}$/.test(resourceServerClientId))
      throw new Error("Unsafe Keycloak UMA configuration");
    this.tokenEndpoint = url.toString();
    this.audience = resourceServerClientId;
    this.send = send;
  }

  /** No JWT decoding here: verifiedAccessToken must be authenticated by the caller.
   * No delegation to browsers, no caching, no policy writes.
   * 403 = denied; malformed results/outage throw and MUST be treated as deny.
   */
  async check(input: Readonly<{
    verifiedAccessToken: string;
    context: TrustedKeycloakPilotContext;
    capability: KeycloakPilotCapability;
    /** Resource/scope IDs reconciled against the trusted Keycloak catalog, never the browser. */
    keycloakResource: Readonly<{ id: string; name: string; scopeId: string; scopeName: string }>;
  }>): Promise<boolean> {
    if (!input || typeof input.verifiedAccessToken !== "string" ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.verifiedAccessToken))
      return false;
    if (!Object.hasOwn(PILOT_SCOPES, input.capability)) return false;
    if (PILOT_SCOPES[input.capability] !== input.context?.kind) return false;
    let name: string;
    try { name = pilotResourceName(input.context); }
    catch { return false; }
    const mapped = input.keycloakResource;
    if (!mapped || mapped.name !== name || mapped.scopeName !== input.capability ||
        !UUID.test(mapped.id) || !UUID.test(mapped.scopeId)) return false;

    const form = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
      audience: this.audience,
      permission: mapped.id + "#" + mapped.scopeId,
      response_mode: "decision",
      submit_request: "false",
    });
    let response: Response;
    try {
      response = await this.send(this.tokenEndpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + input.verifiedAccessToken,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(3000),
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      throw new Error("Keycloak UMA request unavailable");
    }
    if (response.status === 403) return false;
    if (response.status !== 200) throw new Error("Keycloak UMA status unavailable");
    let result: unknown;
    try { result = await response.json(); }
    catch { throw new Error("Keycloak UMA response invalid"); }
    if (!result || typeof result !== "object" || Array.isArray(result) ||
        Object.keys(result).length !== 1 || typeof (result as {result?: unknown}).result !== "boolean")
      throw new Error("Keycloak UMA response invalid");
    return (result as {result: boolean}).result === true;
  }
}
