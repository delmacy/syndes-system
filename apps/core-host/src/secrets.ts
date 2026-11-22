import { readFile } from "node:fs/promises";
import {secretNamespaceFromEnv,stageFileSecretsEnabled,validateSecretNamespace,type SecretNamespace} from "./secret-namespace.js";

/** OpenBao AppRole credentials are file-mounted; no database password or FGA
 * API token is passed by Docker Compose or stored in process.env. */
export type CoreRuntimeSecrets = Readonly<{
  controlDbUrl: string;
  openfgaToken: string;
}>;
export type OpenBaoSource = Readonly<{
  address: string;
  roleIdFile: string;
  secretIdFile: string;
  namespace?: SecretNamespace;
}>;

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Missing or malformed OpenBao secret");
  }
  return value;
}

function httpUrl(base: string, path: string): string {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/"
      || url.search || url.hash) {
    throw new Error("OpenBao must use an HTTPS root endpoint");
  }
  return new URL(path, url).toString();
}

async function jsonRequest(
  fetcher: typeof fetch,
  address: string,
  path: string,
  options: RequestInit,
): Promise<unknown> {
  const resp = await fetcher(httpUrl(address, path), {
    ...options, redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) throw new Error("OpenBao request rejected");
  return resp.json() as Promise<unknown>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Unexpected OpenBao response");
  }
  return value as Record<string, unknown>;
}

function validatedSecrets(values:Record<string,unknown>,namespace:SecretNamespace):CoreRuntimeSecrets{
  const loaded=Object.freeze({
    controlDbUrl: requiredString(values.control_db_url),
    openfgaToken: requiredString(values.openfga_token),
  });
  if(namespace==="multi-org-staging"){
    let db:URL;
    try{db=new URL(loaded.controlDbUrl)}
    catch{throw new Error("Invalid staging Control database boundary")}
    if(!["postgres:","postgresql:"].includes(db.protocol)||
       db.hostname!=="control-postgres"||(db.port&&db.port!=="5432")||
       db.pathname!=="/syndes_staging_control"||
       db.username!=="syndes_staging_core"||!db.password||db.search||db.hash)
      throw new Error("Invalid staging Control database boundary");
  }
  return loaded;
}

export async function loadConfiguredCoreSecrets(env:NodeJS.ProcessEnv=process.env):Promise<CoreRuntimeSecrets>{
  if(!stageFileSecretsEnabled(env))return loadCoreSecrets(openBaoSourceFromEnv(env));
  return loadStageCoreSecrets();
}

export async function loadStageCoreSecrets(path="/run/secrets/stage-core.json"):Promise<CoreRuntimeSecrets>{
  const values=await readStageSecret(path);
  return validatedSecrets(values,"multi-org-staging");
}

export async function readStageSecret(path:string):Promise<Record<string,unknown>>{
  try{
    const value=record(JSON.parse(await readFile(path,"utf8")) as unknown);
    if(value.namespace==="multi-org-staging")return value;
  }catch{ /* Read errors and malformed JSON must not expose credential content. */ }
  throw new Error("Missing or malformed staging credential file");
}

export async function loadCoreSecrets(
  source: OpenBaoSource,
  fetcher: typeof fetch = fetch,
): Promise<CoreRuntimeSecrets> {
  const namespace=validateSecretNamespace(source.namespace);
  // Never allow a stale environment variable to replace a failed OpenBao read.
  const roleId = requiredString((await readFile(source.roleIdFile, "utf8")).trim());
  const secretId = requiredString((await readFile(source.secretIdFile, "utf8")).trim());

  const login = record(await jsonRequest(fetcher, source.address, "/v1/auth/approle/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  }));
  const token = requiredString(record(login.auth).client_token);
  let loaded: CoreRuntimeSecrets | undefined;
  try {
    const response = record(await jsonRequest(fetcher, source.address, "/v1/kv/data/"+namespace+"/core-host", {
      method: "GET", headers: { "X-Vault-Token": token },
    }));
    const values = record(record(response.data).data);
    loaded = validatedSecrets(values,namespace);
  } finally {
    // The read-only AppRole token must not remain valid after bootstrap.
    try {
      const revoke = await fetcher(httpUrl(source.address, "/v1/auth/token/revoke-self"), {
        method: "POST",
        headers: { "X-Vault-Token": token },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      // Token revocation normally returns 204 No Content.
      if (!revoke.ok) throw new Error("Revoke request was rejected");
    } catch {
      // Fail startup rather than allowing an orphaned bootstrap token.
      throw new Error("OpenBao bootstrap token revocation failed");
    }
  }
  return loaded!;
}

export function openBaoSourceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OpenBaoSource {
  return {
    namespace:secretNamespaceFromEnv(env),
    address: env.CORE_OPENBAO_URL ?? "https://openbao:8200",
    roleIdFile: env.CORE_BAO_ROLE_ID_FILE ?? "/run/secrets/core_host_role_id",
    secretIdFile: env.CORE_BAO_SECRET_ID_FILE ?? "/run/secrets/core_host_secret_id",
  };
}
