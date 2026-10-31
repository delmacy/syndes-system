# WhatsApp Admin — separate Next.js UI

Independent of the Go gateway; no HTML or React code is embedded in the Go service.

## Authentication
Login uses Auth.js v5 + Keycloak OIDC and denies accounts that do not have the realm role `syndes-gateway-admin` (configurable with `AUTH_ADMIN_ROLE`).
Configure a Keycloak OIDC confidential client with redirect URI `https://YOUR_ADMIN_DOMAIN/api/auth/callback/keycloak`.
Add an ID-token mapper/client scope that includes `realm_access.roles`; without the expected role the login is rejected.
Set `AUTH_SECRET`, `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET`, `AUTH_KEYCLOAK_ISSUER` and your trusted HTTPS hostname.
Do not expose the admin page until Keycloak and HTTPS are configured.

## Backend connectivity
The Next.js server (not the browser) calls `GATEWAY_INTERNAL_URL` using `GATEWAY_ADMIN_TOKEN`.
The gateway itself remains on a private Docker network without a published host port. Do not expose gateway API directly.
For production use a dedicated scoped service identity and audit, rather than a long-lived shared bootstrap secret.

## Development
`npm install && npm run lint && npm run build`; `npm run dev` after configuring environment.

## Service authentication
In production configure `GATEWAY_SERVICE_TOKEN_URL`, `GATEWAY_SERVICE_CLIENT_ID` and `GATEWAY_SERVICE_CLIENT_SECRET` to request a short-lived Keycloak client-credentials token for gateway REST requests. Configure the Keycloak service-account client with audience `GATEWAY_AUDIENCE` and scope `gateway.admin`. When all three service variables exist, the app does not use the bootstrap static token. Never expose the service secret to client-side JavaScript.
