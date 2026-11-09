# Module mounting — Syndes Core Host

The host installs approved packages at build time, listed in `apps/core-host/config/modules.json`. They are **trusted, compiled packages**, not user-uploaded code. This is a low-overhead modular monolith.

Each package provides `syndesPlugin` from its exported `./plugin` entry point via `defineSyndesModule`, including:

- `definition`: version, module ID and dependencies checked with `ModuleRegistry` before Host startup.
- `apiModule`: a NestJS module with its own controllers/providers; the Host contributes verified identity, CoreKernel and tenant-database ports through a global infrastructure module.
- `assets`: exact routes, MIME types and packaged file URLs; generic middleware serves only enumerated paths with security headers.
- `migrations`: ordered, approved SQL resources packaged with the module.
- `permissions`: resource IDs and allowed read/write action names, supplied for provisioning policies. **These descriptors do not grant FGA tuples.**
- `publicOidcClientId` (optional): generic endpoint `/modules/:moduleId/config` exposes only public client metadata.

CRM package: `@syndes/core-crm`; its API controllers, browser assets, SQL migrations and permission declarations are owned inside the CRM package. Core Host retains only cross-cutting concerns and `config/modules.json`. Adding another trusted module requires adding its locked package dependency and its exported specifier to the config, not changing Core Host controllers.

## Migrations

`dist/migrations.js --list` returns installed module IDs and migration IDs; `--emit <module> <migration>` emits only trusted package SQL and never accepts arbitrary paths. Operator script `infra/postgres/bootstrap/migrate-modules-tenant.sh` checks the canonical active/provisioned tenant registry and applies the listed SQL under the tenant's database role. It requires a previously built pinned Core Host Docker image via `SYNDES_CORE_HOST_IMAGE`; it does not require Keycloak or OpenBao credentials to inspect migration assets.

```sh
export TENANT_ID=4ab44379-d557-4df6-a2be-d44e121a8077
export SYNDES_CORE_HOST_IMAGE=syndes-core-host:approved-build
bash infra/postgres/bootstrap/migrate-modules-tenant.sh
```

**Operator-only**. Make sure image and local Compose configuration originate from the same approved commit. Migrations are additive/idempotent for the current three SQL files. Fully tracked upgrade/rollback/version ledger is still a production lifecycle enhancement; do not treat the script as an arbitrary plugin marketplace.

## Trust model

Modules execute in the Core Host process and therefore **are not sandboxed against the Host**. Publishing the SDK does not authorize unreviewed third-party code. Before approving a package, require reviewed source, pinned dependency versions, explicit permissions, integration tests, a signed build and a controlled rollout.

Running packages are still subject to the CoreKernel tenancy/authorization checks, canonical database resolver, separate tenant PostgreSQL roles and OpenBao policy. These are not replacements for a supply-chain security policy.
