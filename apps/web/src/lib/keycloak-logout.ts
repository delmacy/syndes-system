export function buildKeycloakLogoutUrl(input: {
  issuer: string;
  idToken: string;
  postLogoutRedirectOrigin: string;
  clientId: string;
}): URL {
  const logout = new URL(
    `${input.issuer.replace(/\/$/, '')}/protocol/openid-connect/logout`,
  );
  logout.searchParams.set('id_token_hint', input.idToken);
  logout.searchParams.set(
    'post_logout_redirect_uri',
    input.postLogoutRedirectOrigin,
  );
  logout.searchParams.set('client_id', input.clientId);
  return logout;
}

/** Auth.js transient cookies that may remain after a custom Keycloak end-session redirect. */
export function authJsTransientCookieNames(secure: boolean): string[] {
  const prefix = secure ? '__Secure-' : '';
  const hostPrefix = secure ? '__Host-' : '';
  return [
    `${prefix}authjs.callback-url`,
    `${hostPrefix}authjs.csrf-token`,
    `${prefix}authjs.pkce.code_verifier`,
    `${prefix}authjs.state`,
    `${prefix}authjs.nonce`,
  ];
}
