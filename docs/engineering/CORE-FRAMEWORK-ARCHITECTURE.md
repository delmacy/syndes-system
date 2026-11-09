# Syndes Core as a reusable framework — ADR-001

**Status:** Accepted for initial foundation; implementation beyond this kernel is incremental.

## Decision
Build Syndes Core with a reusable, application-agnostic **kernel** and domain modules distributed as separate packages when actual consumers justify it. The primary host remains a **NestJS modular monolith** to minimize memory overhead.

```text
apps/core-api (NestJS composition root; future)
  ├── packages/core-kernel (versioned public contracts)
  ├── packages/core-adapters (future: Keycloak / OpenFGA / control DB)
  ├── modules/core-crm (first business implementation)
  └── other modules as the MVP needs them

Dedicated processes:
  WhatsApp Go Gateway
  Identity stack: Keycloak + OpenFGA + PostgreSQL
```

## Stable contracts
1. Module metadata: ID, SemVer, dependencies, initialization; module dependencies resolved before startup; cycles rejected.
2. Public exports from `@syndes/core-kernel` are the only stable kernel API. Internal paths are not extension points.
3. Authentication is the application host's responsibility. The kernel accepts an authenticated Actor, never credentials.
4. Tenant resolution is server-side. A caller-supplied tenant ID never selects a database by itself.
5. Tenancy and resource policy are separate adapter ports and **both must authorize** before a domain operation.
6. Domain data and persistence are owned by domain modules. The platform control database and each tenant PostgreSQL database remain separate.
7. No platform administrator automatically receives domain-data access.
8. Operational gateways use stable ports/contracts; SDK/network clients are injected by the application host.
9. Errors in permission systems block protected operations. No implicit allow, even for a service account.

## Planned evolution (only when needed)
- Phase A (this PR): kernel, module registry, tenancy/authorization ports, CI, dependency graph validation.
- Phase B: NestJS adapter + Core CRM as first consumer; fail-closed guards; verified tenant database routing.
- Phase C: shared audit and entitlement ports, platform module registry and migrations exercised through real CRM workflows.
- Phase D: public contributor SDK, examples, documentation, SemVer compatibility checks and an explicit open-source license.

## Explicitly excluded from the foundation
Plugin marketplace, runtime loading of arbitrary user code, universal workflow orchestration, redundant microservices, generic dynamic database models, business-specific authorization rules and optional libraries that increase runtime RAM without current demand.

## Contribution and publication
`packages/core-kernel` is currently private to avoid accidental npm release. Extracting and publishing publicly requires a reviewed licensing decision, security policy, CI and version tagging. Consumer code must not import private internal file paths.

## Acceptance
- A dummy CRM module registers without kernel modification.
- Dependency ordering, duplicate ID, missing dependency and cycle rejection are tested.
- Tenant A cannot execute protected operations under tenant B.
- Policy denial and authorization backend exceptions do not execute handlers.
- Startup failure blocks operations; retries do not repeat partially completed initialization.
- TypeScript build, tests, and package inspection pass in GitHub Actions.
