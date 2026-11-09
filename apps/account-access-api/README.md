# Syndes Account Access API — DC-2b

**Status: code and disposable integration tests only, NOT DEPLOYED.** Part of issue #49 / PR #51. This process is separate from the Core Host and the Platform Manager. Do not publish a public ingress until a dedicated environment, Keycloak audience, OpenFGA grant, secret delivery, rate-limit strategy, audit review and Product Gate have been approved.

## Single endpoint

`POST /v1/accounts/:tenantId/access/delegations` with JSON `{"operation":"grant|revoke","principalId":"<verified sub>","role":"admin|owner"}`. Requires `Authorization: Bearer` with **dedicated** JWT issuer/aud/azp, an exact authorized Origin, and `Idempotency-Key: <UUID>`. Replies with role, resulting state and whether the request was already applied. No listing, employee discovery or self-service owner bootstrap is implemented. `GET /healthz` and `GET /readyz` only expose basic service health.

**Authorization in order:** verify signed OIDC JWT and expected client, parse bounded request, independently check OpenFGA `account:roles/write` bound to tenant, then execute the **sole** SECURITY DEFINER SQL entrypoint `apply_tenant_account_delegation`. That function rechecks active tenant, source owner with active `tenant_memberships`, active target membership, idempotency and serializes writes per tenant. Never use `platform_operator_access` as tenant permission. FGA permission grants are provisioned explicitly in another approved workflow; this API NEVER writes FGA tuples.

## SQL

`infra/postgres/bootstrap/control-account-delegation.schema`, manually applied only after `control.schema` and `control-account-roles.schema` (DC-2a). Creates NOLOGIN group role `syndes_account_delegate` with only EXECUTE on the delegation function, no direct SELECT/DML to grants/audits/tenant registry. **Does not create a login or passwords.** Authorized DB operations later create a distinct LOGIN role `syndes_account_api`, grant membership in the non-login role, protect credentials via OpenBao/AppRole to `/run/secrets/account_db_url`, and deploy the service on a private network. No user or admin role is created by migrations. A direct `syndes_core` invocation is forbidden. To prevent indirect RLS spoofing, the function accepts only immutable subject from verified JWT (API invariant); DB alone cannot prove a bearer was verified.

The anti-replay record is `(tenant_id,request_id)`. A repeated identical request returns the original result; reuse for a different request fails. The database function relies on a per-tenant transaction advisory lock to serialize grant/revoke operations. Audit is appended in the same transaction. Audit UPDATE/DELETE/TRUNCATE are blocked for ordinary DB operations; a PG superuser still controls the DB and independent backup/audit export remains necessary.

**Last-owner membership guard:** this DC-2b schema also installs a trigger on `tenant_memberships`: revoking or deleting the final effective account owner's underlying membership is rejected under the same tenant-specific advisory lock. This closes the DC-2a bypass for subsequent changes. Existing orphaned accounts (if any) still require authorized, audited break-glass recovery, and every membership-writing workflow must be separately regression tested.

## OIDC and runtime

Required environment (NO passwords):

- `ACCOUNT_DB_URL_FILE` absolute secret file under `/run/secrets`, DB `syndes_control`, user `syndes_account_api`.
- `ACCOUNT_OIDC_ISSUER` HTTPS, `ACCOUNT_OIDC_AUDIENCE=syndes-account-api`, `ACCOUNT_OIDC_CLIENT_ID=syndes-workspace-ui`, `ACCOUNT_OIDC_JWKS_URL` internal, TLS-authenticated issuer validation.
- `ACCOUNT_OPENFGA_URL`, `ACCOUNT_OPENFGA_STORE_ID`, `ACCOUNT_OPENFGA_TOKEN_FILE` protected token file.
- `ACCOUNT_ALLOWED_ORIGIN` exact HTTPS Workspace origin.
- `ACCOUNT_PORT` optional 8086; `ACCOUNT_BIND_HOST` defaults to 127.0.0.1; publishing through private gateway requires a separate authorized deployment.

Neither token nor SQL DSN is included in errors or logs. The route has no customer data access.

## Evidence

`cd apps/account-access-api && npm ci && npm test`, `cd packages/core-kernel && npm test`, and `bash tests/platform/account-roles-pg-smoke.sh` with disposable Docker PG 17. The GitHub `core-host-infra.yml` runs these tests, and none of them changes DevServer01 production Control DB or active tenant databases.
