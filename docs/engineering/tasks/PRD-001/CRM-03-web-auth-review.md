# CRM-03 web auth infrastructure review (worker)

Ownership: `apps/web/**` only. No commit/push. No API/workflow/task-doc edits. No E2E.

## What changed

- Keycloak Auth.js: explicit `checks: ['pkce','state','nonce']`, `code_challenge_method: S256`, email account linking disabled, `trustHost: true`.
- Session cookie: production `__Host-syndes.session-token` (Secure/HttpOnly/SameSite=Lax/path=/; no Domain = host-only).
- Tokens: access/id tokens stored only in encrypted JWT cookie; session callback strips them from client session.
- BFF `/api/backend/[...path]`: Origin CSRF for mutating methods; bearer from server JWT; signs `x-syndes-validated-*` HMAC; never forwards client tenant/database selectors; host normalized to API verifier pattern.
- Logout `/api/auth/keycloak-logout`: Origin check, clears app session + Auth.js transient cookies, RP-initiated Keycloak logout via `id_token_hint`.
- MFA helper: `signInPlatformAdmin()` requests `acr_values=mfa`.
- App shell: sign-in / server-session status / logout form only (no CRM UI).
- Helpers + unit tests under `src/lib/*.spec.ts`; `vitest.config.mts`.

## Files touched (apps/web)

- `src/auth.ts`
- `src/types/next-auth.d.ts`
- `src/app/page.tsx`
- `src/app/layout.tsx` (unchanged shell)
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/auth/keycloak-logout/route.ts`
- `src/app/api/backend/[...path]/route.ts`
- `src/lib/session-cookie.ts` (+ spec)
- `src/lib/request-origin.ts` (+ spec)
- `src/lib/tenant-host.ts` (+ spec)
- `src/lib/keycloak-logout.ts` (+ spec)
- `src/lib/ingress-signature.ts` (+ tightened spec)
- `vitest.config.mts`
- `.env.example`, `package.json` scripts already present

## Commands and results (dummy CI-only env)

```powershell
$env:AUTH_SECRET="test-only-auth-secret-for-build-and-unit-tests"
$env:AUTH_URL="http://localhost:3000"
$env:KEYCLOAK_ISSUER="https://identity.example.test/realms/syndes"
$env:KEYCLOAK_WEB_CLIENT_ID="syndes-web"
$env:KEYCLOAK_WEB_CLIENT_SECRET="ci-test-only"
$env:SYNDES_API_URL="http://localhost:3001"
$env:INGRESS_SIGNING_SECRET="ci-test-only-ingress-signing-secret"
npm run lint      # pass
npm run typecheck # pass
npm test          # 5 files / 9 tests pass
npm run build     # Next.js 16.4.3 production build pass
```

Routes built: `/`, `/api/auth/[...nextauth]`, `/api/auth/keycloak-logout`, `/api/backend/[...path]`.

## Unresolved concerns

1. `.github/workflows/api.yml` web job still omits `INGRESS_SIGNING_SECRET` (out of this worker’s ownership). Current unit/build do not require it at module load; BFF requests will 503 without it at runtime.
2. Cookie name changed `__Secure-…` → `__Host-…` for true host-only; any prior browser cookies with the old name are orphaned (acceptable; branch uncommitted).
3. No Keycloak/E2E run (forbidden). Realm must be configured so manager login with `acr_values=mfa` yields access-token `acr=mfa`.
4. `/platform-admin` redirect after MFA is intentional stub until CRM-09; route does not exist yet.
5. Logout HTML form relies on browser `Origin` for CSRF; `AUTH_URL` must match the public site origin exactly.
6. Shared `INGRESS_SIGNING_SECRET` + private API reachability remain deployment obligations (documented in CRM-03 task).

## Coordinator follow-up

- Added the missing CI `INGRESS_SIGNING_SECRET` fixture and request-side tenant-selector rejection in the BFF; API rejects selectors independently. Added focused tests for the selector checks.
- The final local web run passed lint, typecheck, 11/11 tests, and production build. `npm audit` reported no vulnerabilities.
- GitHub Actions run [40539707820](https://github.com/delmacy/syndes-system/actions/runs/40539707820) passed the web job on commit `20ecc5e`.
- The earlier CI-secret omission noted above was resolved in the coordinator-owned workflow before the passing run. Keycloak realm configuration and live MFA behavior remain deployment verification items; no frontend E2E was run.
