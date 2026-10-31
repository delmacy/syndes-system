# WhatsApp Admin (independent frontend)

Separate Next.js application consuming the **Go gateway REST API server-side**. Do not mix React/HTML/CSS code with the Go gateway module.

## Security
**This is an internal bootstrap prototype, not an authenticated production panel.**
Keep it reachable exclusively through a private VPN or identity-aware access proxy until Keycloak OIDC, session management, CSRF and per-operation RBAC are implemented. The Node server reads the secret from `GATEWAY_ADMIN_TOKEN`; the browser never sees it.

## Run
`npm install && npm run dev`, after configuring the environment. In Docker, `GATEWAY_INTERNAL_URL` should resolve to the Go gateway's internal DNS name. Do not expose the gateway port to the public internet.
