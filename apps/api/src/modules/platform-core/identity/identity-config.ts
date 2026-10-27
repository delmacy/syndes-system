export function readIdentityConfig(env: NodeJS.ProcessEnv = process.env) {
  const issuer = required('KEYCLOAK_ISSUER', env).replace(/\/$/, '');
  const allowedParties = required('KEYCLOAK_ALLOWED_AZP', env)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedParties.length)
    throw new Error('KEYCLOAK_ALLOWED_AZP must list at least one client');
  return {
    issuer,
    audience: required('KEYCLOAK_API_AUDIENCE', env),
    authorizedParties: new Set(allowedParties),
    jwksUrl: new URL(`${issuer}/protocol/openid-connect/certs`),
  };
}

function required(key: string, env: NodeJS.ProcessEnv): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required for API identity validation`);
  return value;
}
