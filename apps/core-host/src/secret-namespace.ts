/** Deployment configuration is trusted process configuration, never HTTP input.
 * No arbitrary KV prefix or database host can be supplied by a tenant. */
export type SecretNamespace="production"|"multi-org-staging";
export function secretNamespaceFromEnv(
 env:Readonly<Record<string,string|undefined>>=process.env,
):SecretNamespace{
 if(env.SYNDES_DEPLOYMENT_ENV===undefined||env.SYNDES_DEPLOYMENT_ENV==="production")
  return "production";
 if(env.SYNDES_DEPLOYMENT_ENV==="staging")return "multi-org-staging";
 throw new Error("Unsupported secret deployment environment");
}
export function validateSecretNamespace(value:unknown):SecretNamespace{
 if(value===undefined)return "production"; // existing trusted-source callers
 if(value==="production"||value==="multi-org-staging")return value;
 throw new Error("Invalid secret namespace");
}
export function tenantDatabaseHost(namespace:SecretNamespace):string{
 return validateSecretNamespace(namespace)==="multi-org-staging"?
  "control-postgres":"syndes-postgres";
}

export function fileSecretNamespace(env:NodeJS.ProcessEnv=process.env):SecretNamespace|undefined{
 if(env.CORE_SECRET_PROVIDER===undefined||env.CORE_SECRET_PROVIDER==="openbao")return;
 if(env.CORE_SECRET_PROVIDER==="files"&&env.SYNDES_DEPLOYMENT_ENV!==undefined)return secretNamespaceFromEnv(env);
 throw new Error("Invalid credential provider for this deployment");
}
