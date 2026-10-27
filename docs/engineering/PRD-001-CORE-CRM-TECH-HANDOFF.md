# PRD-001 Core CRM — Technical Handoff

## Status

Handoff inicial para iniciar a fundação do Core CRM. As escolhas aprovadas são NestJS para a API backend, Next.js App Router para o frontend em app separado, e Drizzle ORM com `pg` para acesso a dados. O manager/Control Plane administra tenants em um database próprio, separado dos databases de negócio. Cada tenant/cliente tem seu próprio database PostgreSQL; os dados do Core CRM ficam no database do tenant correspondente.

## Decisions recorded

| Decision | Status | Source |
|---|---|---|
| Backend framework: NestJS | Approved | User instruction |
| Frontend framework: Next.js | Approved | User instruction |
| Next.js routing: App Router | Selected default | Codex technical decision; app is a new Next.js project |
| Frontend is separated from the API and organized by product module | Approved | User instruction and Core CRM gate |
| React + Vite | Rejected/superseded | Earlier worker proposal; Next.js selected by user |
| ORM/data access: Drizzle ORM + `pg` | Approved | User approval of the OpenCode proposal |
| Tenant storage: separate PostgreSQL database per tenant/client | Approved | User confirmation and root `AGENTS.md` |
| Manager/Control Plane has a separate database for tenant-management data | Approved | User clarification and `modules/platform-core/AGENTS.md` |
| Core CRM business data lives in the corresponding tenant database | Approved | User clarification and root `AGENTS.md` |
| Platform admin does not receive automatic access to tenant CRM content | Approved | Root `AGENTS.md` and `modules/platform-core/AGENTS.md` |
| Identity service: Keycloak, consumed using OIDC; MFA and SSO capability are required; tenant membership/permissions remain in the Control Plane | Selected by user | User direction after comparison of library vs. OIDC identity service |
| Platform Admin MFA is mandatory; tenant-member MFA follows an operator-configurable Keycloak realm policy | Approved | User clarification |
| Keycloak realm SSO is in MVP; per-tenant external SAML/OIDC federation is post-MVP | Approved | User selection and `modules/platform-core/AGENTS.md` scope boundary |
| Tenant authorization has distinct `tenant_admin` and `tenant_member` roles; `tenant_member` cannot archive or export | Approved | User clarification |
| Employee is a tenant staff/attendant profile optionally linked to a login; same CRM UI; tenant_admin edits the fixed customer scope (`cpf`, `pj`, `both`) for tenant_member | Approved | User clarification |
| `pj` scope includes an Organization and its linked contact Persons; `cpf` scope includes Persons with no PJ link | Approved | User clarification |
| Migrations: reviewed SQL files applied with Drizzle's PostgreSQL migrator as a separate release step, never automatically on API startup | Selected default; initial Control Plane registry migration added | Codex technical decision; avoids concurrent app instances racing migrations |
| Migration tooling: Drizzle ORM migrator (`drizzle-orm/node-postgres/migrator`), without `drizzle-kit` | Selected | `drizzle-kit` was removed after dependency audit identified moderate transitive advisories; current API dependency audit is clean |

## Product gate and boundaries

- Current module: Core CRM (PRD-001).
- Classification: MVP.
- Identity direction: Keycloak as the OIDC identity service, with MFA and SSO capability; selected by the user. Platform membership/tenant authorization remains in the Control Plane.
- Build a modular monolith; do not create services or generic plugin/workflow frameworks.
- CRM is the canonical source for people and organizations.
- Implement only the Platform Core capabilities needed for the Core CRM journey.
- Do not implement features from later product modules before this module passes its gate.

### CRM-00 contracts for implementation

The following contracts unblock backend work. The Keycloak service choice, MFA rule, SSO scope, and CRM role split above were confirmed by the user. The protocol and API details below are Codex technical decisions derived from the approved scope.

#### Identity and session

- Next.js is the OIDC relying party and server-side BFF. Use one maintained Auth.js Keycloak provider with Authorization Code flow, PKCE S256, state, and nonce; pin a security-fixed release in the lockfile, disable email-based account linking, keep tokens out of browser JavaScript, and never authorize by the truthiness of an auth/session object alone. The browser session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, host-only, and cleared on logout; server routes call NestJS.
- NestJS accepts only bearer access tokens and verifies signature via Keycloak JWKS plus exact `iss`, API `aud`, authorized client (`azp`), `exp`, `nbf`, and `sub` using a maintained JWT library (`jose`); no manual JWT cryptography. The configured ACR value `mfa` is emitted in the access token after Keycloak MFA. Manager routes require `acr=mfa` plus the Control Plane `platform_admin` role; tenant routes use their own membership checks.
- Use one Syndes Keycloak realm and one OIDC web client for the MVP. Realm SSO across Syndes applications is supported. The manager BFF requests the configured MFA ACR; the API checks that claim. No per-tenant external identity federation, SAML/SCIM or customer IdP setup before launch.
- `AuthenticatedActor.id` is a permanent Control Plane UUID. External identity is uniquely mapped by exact `(issuer, subject)`; email is profile data, never an account-linking key. Do not take product roles, tenant IDs, or database names from Keycloak claims.
- Platform Admin identity is authorized only for manager routes and never gets an implicit tenant context. `tenant_admin` and `tenant_member` are Control Plane memberships; active membership is required for tenant CRM requests. `tenant_admin` may perform all approved CRM operations including archive/export and edit member customer scope. `tenant_member` may read/create/update approved CRM records within `customer_scope` but may not archive/export. Fixed scopes are `cpf`, `pj`, `both`; unknown roles/scopes deny by default.
- Tenant routing is resolved server-side from the trusted ingress hostname mapping in Control Plane, then checked against the actor's active membership. The ingress must strip client-supplied routing headers and provide only its validated host value. No request body/query/header accepts `tenant_id`, `database_name`, or a database selector. Cross-tenant IDs return 404 to avoid confirming existence.

#### API, CSV, and CRM domain

- NestJS routes use `/api/v1`. Successful responses are resource JSON without a generic wrapper. Errors use RFC 9457 Problem Details with stable `code`, `requestId`, and safe field errors; do not include stack traces or secrets. Cross-tenant resources use 404; unauthenticated requests use 401; authenticated insufficient permissions use 403.
- CSV uses UTF-8 (optional BOM), a required header row, comma delimiter, maximum 10 MiB, 10,000 data rows, and 30 columns. Reject malformed/duplicate headers and oversized inputs. Import validates the whole file before writing and is all-or-nothing; if any row is invalid, no CRM records are written. Return at most 100 row errors plus total invalid-row count. Export applies role and tenant filters and neutralizes formula-leading cells (`=`, `+`, `-`, `@`).
- Tags and Notes attach to Person or Organization only. Timeline is chronological and includes Person/Organization create, update, archive; Relationship create/remove; Tag attach/detach; and Note create. The audit log remains a separate security record; reads are not Timeline events. Every operation, including search, relationship lookup, timeline and CSV, applies the actor's customer scope.
- `Employee` in CRM-05 is a tenant staff/attendant profile with stable ID, active status, and optional unique link to a Control Plane actor ID. The linked identity and membership remain Control Plane data; Employee stores no login credentials. Employee management and customer-scope settings appear inside the same Core CRM application; do not create a separate staff portal.

#### Tenant provisioning

- Control Plane provisioning states are `pending → in_progress → ready | failed`; retry transitions `failed → in_progress`; retry of `ready` is an idempotent no-op. No API deletes tenant databases or moves a ready tenant backward.
- Tenant database names are generated from the permanent tenant UUID, never supplied by the client or derived from display name. Provisioning creates a database and least-privilege tenant DB role under a per-tenant lock, creates the credential in the deployment's approved secret store, applies reviewed migrations sequentially outside API startup, then marks `ready`.
- A failed provisioning attempt records a sanitized failed step and leaves durable partial state for safe resume. Secrets and connection strings never enter Control Plane rows, API responses, logs, or artifacts. The secret-store adapter and numeric pool limit are selected from the deployment environment and measured load; do not invent provider credentials or pool counts in this task.

Identity references: [Auth.js Keycloak provider](https://github.com/nextauthjs/next-auth/blob/main/packages/core/src/providers/keycloak.ts), [jose JWT verification options](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md), and [Keycloak OIDC application guidance](https://www.keycloak.org/securing-apps/overview). Review security advisories and pin patched package versions when the auth implementation is created.

## Backend boundary

Use NestJS with feature modules and explicit imports/exports. Nest modules encapsulate providers by default; exports form the public interface between modules. See the [NestJS modules guide](https://docs.nestjs.com/modules).

Proposed layout:

```text
apps/api/
  src/
    app.module.ts
    modules/
      platform-core/   # manager/Control Plane and tenant-management capabilities required now
      core-crm/        # CRM HTTP/API and business behavior
```

`CoreCrmModule` owns the approved CRM capabilities: Person, Organization, Relationship, Employee, Tag, Note, Timeline, and ChannelIdentity. Keep domain rules in Core CRM. Platform Core may provide only the minimum infrastructure contracts needed to enforce server-side tenant resolution, authorization, audit, and access to the tenant database.

The manager/Control Plane owns tenant-management metadata, registry, and the minimum provisioning operations needed by the current module. It uses its own database. Tenant CRM data remains in that tenant's PostgreSQL database. Keep the Control Plane manager and tenant-facing Core CRM as separate NestJS modules and Next.js frontend modules, while keeping them in the modular monolith unless evidence requires a separate deployment. The platform-admin interface must manage tenant metadata without gaining automatic access to business records.

Tenant/database selection must be resolved server-side; never accept a database or tenant selector from the client. Requests for another tenant's IDs must return denied/not found.

Drizzle ORM with `pg` is the approved data-access choice. The initial Control Plane tenant-registry schema and migration are now present, but the NestJS runtime still has no database providers or tenant routing. Do not use client input to choose a tenant database, and do not freeze pool sizes from guesses; measure them against the repository's controlled load profiles.

## Frontend boundary

The frontend uses the approved Next.js framework and is organized by product module, separate from the NestJS API. Next.js owns routing and composition; NestJS remains the source of backend CRM behavior and persistence.

Approved application/module boundary:

```text
apps/web/
  src/
    app/              # Next.js routing and composition; keep product rules out of this layer
    modules/
      platform-admin/ # separate manager interface for tenant administration only
      core-crm/       # only frontend scope for the current product gate
    shared/           # generic shell, design primitives, and transport helpers only
```

The platform-admin frontend module is separate from `core-crm` and owns only tenant-management workflows backed by Control Plane APIs. It must not read or render tenant CRM business records. The Core CRM frontend owns its pages/screens, forms, search interactions, API queries, and user-facing validation within `modules/core-crm`. The Next.js routing layer composes these module-owned screens; CRM terminology and business behavior stay out of `shared`. Next.js must consume the NestJS API rather than duplicating CRM domain endpoints or persistence in frontend route handlers.

### Minimal Platform Admin scope for this gate

- List and view tenant-management metadata and provisioning status.
- Create a tenant using a permanent ID independent of its commercial name.
- Start or retry idempotent tenant provisioning and show success/failure state.
- Assign/revoke `tenant_admin` or `tenant_member` access by exact Keycloak issuer/subject. The operator creates the Keycloak identity manually until Onboarding; membership changes are audited and do not grant Platform Admin access to CRM records.
- Edit only approved tenant metadata; never expose connection credentials in the UI.
- Do not browse, search, export, or mutate tenant CRM business records from the manager.
- Defer billing actions, subscription entitlements, hard deletion, and tenant suspension policies to their approved product gates unless a concrete blocker requires them now.

### Core CRM frontend scope

- Organization list, detail, create, edit, and archive.
- Person list, detail, create, edit, and archive.
- Person-to-organization relationship management.
- Tag management and assignment.
- Notes and chronological timeline display.
- Search by approved name, company, phone, email, CNPJ, and tags.
- A clear possible-duplicate warning; no automatic merge.
- CSV import/export flows with validation feedback and permission-aware export.
- Channel identities linked to a Person, with external names shown as metadata and never silently overwriting a confirmed CRM name.
- Demonstrable journey: login → Organization → Person → Relationship → Tags → Note → Search → Timeline → Archive → CSV export.

Do not add pipeline, deals, lead scoring, forecasting, proposals, marketing automation, advanced custom fields, or AI in the CRM domain.

Frontend modules for later products will follow the same module-per-product boundary when those products enter their delivery phase. Do not define their technical screens or contracts during PRD-001.

## Security and data invariants

- Resolve the authenticated actor and tenant on the server before CRM access.
- Apply authorization in backend use paths; UI hiding is not authorization.
- Enforce tenant database routing and ownership on every read, write, import, and export.
- Audit relevant changes; exclude credentials and tokens from logs/evidence.
- Validate and bound CSV input/output; export only records the actor may access.
- Preserve confirmed CRM names when channel metadata changes.
- One cross-tenant disclosure, unauthorized access, or corrupted record blocks acceptance.

## Work packages

The detailed product scope and execution orders are maintained in [PRD-001 Core CRM Product Spec](../product/PRD-001-CORE-CRM-SPEC.md), [Sprint Plan](PRD-001-CORE-CRM-SPRINT-PLAN.md), and [Task Orders](tasks/PRD-001/README.md). Those documents derive from this handoff and do not override its security invariants or unresolved decisions.

### Stage 0 — Finish the technical handoff

**Owner:** Codex coordinates and records the decisions; no worker modifies code in this stage.

- Freeze the Next.js/Keycloak session and NestJS token-validation contract recorded in the CRM-00 section above; do not expose endpoints until CRM-00 is accepted.
- Specify the minimal `AuthenticatedActor` and `TenantContext` contract shared by API modules.
- Specify the Control Plane tenant registry fields and which non-secret reference resolves a tenant database.
- Specify the idempotent provisioning state machine and failure/retry behavior.
- Keep reviewed SQL migrations and their Drizzle journal entries versioned. Control Plane migration command and empty-database CI gate are now present. Tenant migrations still require a separate migration runner; define sequencing, safe resume, and failure reporting before implementation. Do not run migrations during API startup.
- Freeze API versioning, tenant-user authorization rules, platform-admin role, CSV limits, and error shapes needed by the first slices.

**Gate 0:** boundaries and auth/API/provisioning contracts are recorded here; tenant selection remains server-side; migration execution is outside API startup; no future product module was designed; implementation tasks have exclusive file ownership and observable acceptance criteria. Employee/customer-scope semantics and the initial membership runbook are recorded. Gate 0 remains unaccepted until the Control Plane migration proof passes PostgreSQL 16 CI; no manager or CRM endpoint may start before then.

### Stage 1 — Minimal Platform Core for Core CRM

This is transversal prerequisite work for the current Core CRM gate, not a separate functional product phase or a reason to build a generic platform.

1. **Control Plane persistence:** database and migrations for stable tenant identity, tenant metadata, provisioning state, and a non-secret database reference. Keep credentials in the approved secret/configuration channel, not in tenant business records.
2. **Tenant provisioning:** create the tenant database, apply its baseline migration, and record outcomes idempotently. Retry must not create duplicate tenant identities or corrupt a partially provisioned tenant.
3. **Identity and access context:** resolve authenticated platform admins and tenant members; enforce least privilege and derive tenant context server-side.
4. **Tenant database routing:** map the authenticated tenant identity to its database using trusted Control Plane data. Control Plane DB access and tenant DB access remain distinct. Connection lifecycle/pool limits are bounded and observable; set numeric limits from measurements, not guesses.
5. **Audit:** record tenant creation/provisioning and other critical manager changes without logging credentials.
6. **Manager API and UI:** implement only the tenant registry and provisioning workflows listed under Minimal Platform Admin scope, in `platform-core` and `platform-admin` respectively. The manager cannot inspect CRM contents.

**Platform Core acceptance gate:** Control Plane migrations apply to a disposable database; provisioning is idempotent; tenant resolution cannot be changed by client-controlled IDs; platform-admin authorization is tested; manager APIs expose no tenant CRM records; audit evidence exists; failed provisioning is diagnosable and safely retryable.

### Stage 2 — Core CRM tenant data and API

1. Apply a Core CRM baseline migration to one isolated tenant database using the approved Drizzle/`pg` path; prove migration from zero on a disposable PostgreSQL database.
2. Add the approved model and secure API behavior in `apps/api/src/modules/core-crm`: Person, Organization, Relationship, Employee, Tag, Note, Timeline, and ChannelIdentity. Export only the contracts a real consumer needs.
3. Build in reviewable slices: Organizations/People/Relationships; then Tags/Notes/Timeline/Archive/ChannelIdentity; then Search/Normalization/Duplicate warning; then CSV Import/Export.
4. Every operation derives tenant access from `TenantContext`, applies backend authorization, and writes relevant audit events. CRM remains the canonical source for people and organizations.

**Core CRM API gate:** CRUD, relationships, search, normalization, duplicate warning, archive, audit, CSV, permissions, basic concurrency and tenant isolation are covered by the required tests. Tenant B cannot read or mutate Tenant A records.

### Stage 3 — Separate Next.js modules and integrated acceptance

1. Create the Next.js shell only after routing and session contracts are frozen.
2. Build the manager UI in `apps/web/src/modules/platform-admin`; it calls manager APIs and displays only tenant metadata and provisioning outcomes.
3. Build the CRM UI in `apps/web/src/modules/core-crm`; it calls Core CRM APIs and implements the approved CRM screens and journey.
4. Shared UI contains generic shell/design/transport primitives only; it does not own CRM rules or tenant-manager policy.
5. Prove the complete journey from the Core CRM AGENTS file, including Tenant A/Tenant B denial, then complete usability, security, docs, and operational review.

**Integrated acceptance gate:** Next.js and NestJS work together with the approved session/API contracts; both front modules call their own backend boundaries; the manager cannot access tenant content; the Core CRM journey is demonstrated; CI, relevant integration/security tests, and migration validation pass.

## Task ownership and Orca execution strategy

- Codex is coordinator, technical decision owner, reviewer, and gatekeeper.
- Dispatch one mutating worker at a time. Keep Platform Core and Core CRM files under separate ownership; freeze shared contracts before the next dispatch.
- Use OpenCode on its currently available free model/fallback chain for one bounded backend slice at a time. Use Cursor `auto` for an independent bounded review or a frontend slice after the API/session contract is stable; its free quota is limited.
- Other harnesses remain unassigned until their free entitlement and effective model are smoke-tested.
- Each Orca task order names the module/gate, objective, included/excluded scope, dependencies, allowed/forbidden areas, contracts, acceptance criteria, tests, evidence, risks, and next reviewer.
- A worker's success message does not accept the task. Codex reviews its diff and evidence, asks for corrections when needed, and releases the worker after settlement.

Keep each work package independently reviewable and within Core CRM. No two workers may modify the same files concurrently. A worker report or green CI alone is not acceptance.

## Free-harness execution

- Use one mutating worker at a time, with one observable work package per dispatch.
- Give each worker only this handoff, the applicable `AGENTS.md`, and the specific files/contracts needed.
- OpenCode may use only currently available free model IDs from its configured fallback chain; preflight the catalog before a dispatch because free availability can change.
- Cursor `auto` is available in the tested account but has limited free usage; reserve it for a bounded implementation or independent review task.
- Treat any other harness as paid/unknown until a smoke test confirms its effective provider/model and free entitlement.
- Keep Codex as coordinator and reviewer; inspect diffs and required evidence before acceptance.

## Acceptance gate

Core CRM is complete only when the approved CRUD, relationships, search, duplicate warning, normalization, import/export, archive, permissions, audit, migrations, concurrency basics, and acceptance journey are integrated, tested, secure, and demonstrated. Tenant B must be unable to access Tenant A's records. Preserve all existing tests and require the configured CI checks to pass.

Tests are developed alongside the module: every implementation slice adds or updates the relevant tests for the component it delivers. Use unit tests for isolated rules, integration tests for persistence/API/security contracts, and component tests for UI behavior. Do not defer these tests to the end of the CRM phase. Frontend E2E is an opt-in, high-cost acceptance check: identify it when required, but do not run it during normal development. When requested or needed for a gate, run it only through a headless Playwright script that emits logs/results, then review those outputs; do not drive the frontend manually.

## Decisions still required before authenticated API and frontend integration

- Control Plane registry and disposable PostgreSQL CI workflow are implemented but the PostgreSQL 16 workflow has not yet run; tenant migration ownership/rollout remains defined in this handoff for CRM-02.
- Tenant database connection lifecycle and numeric pool limits require measured load; deployment secret-store provider is environment-dependent.
- Initial Keycloak user creation is manual until Onboarding; CRM-04/09 assign the initial tenant_admin by exact issuer/subject, and tenant admins configure member scopes through CRM-03.

### Initial tenant membership runbook (MVP)

1. The operator creates the user's Keycloak account manually; Core CRM has no invitation/email onboarding flow.
2. Retrieve exact OIDC `issuer` and `sub` from the configured Keycloak realm. Email is never used as the membership key.
3. After tenant provisioning, a Platform Admin assigns the first `tenant_admin` role to that exact identity through the manager. This only grants tenant membership, not Platform Admin access to CRM data.
4. The user signs into the shared Core CRM application; the server maps `(issuer, sub)` to a permanent local actor ID and resolves the trusted tenant host plus active membership.
5. The tenant admin grants/revokes later `tenant_member` memberships and sets the fixed customer scope (`cpf`, `pj`, `both`) in CRM settings; changes are audited.
6. Revocation disables access without deleting identity or tenant business data.

## Execution status and evidence

- Added the Control Plane `tenants` schema with permanent UUID identity, display name, unique non-secret database name, provisioning state, and timestamps. This is registry persistence only; there is no manager API, provisioning service, endpoint, auth, or tenant database access yet.
- Added the reviewed initial SQL migration and Drizzle journal, plus `npm run cp:migrations:apply` as a separate release command that reads only `CONTROL_PLANE_DATABASE_URL`.
- Added `.github/workflows/api.yml` with a disposable PostgreSQL 16 service and gates for install, lint, typecheck, unit tests, build, npm audit, and migration from an empty database. Workflow is configured but has not run on GitHub because these changes have not been pushed.
- CRM-01 local evidence: `npm test` (4 suites / 20 tests), lint (0 errors; one pre-existing `main.ts:8` warning), typecheck, build, `git diff --check`, ESM import/helper behavior, credential-free failure behavior, and secret-safety checks passed. The Control Plane migration has not been applied to PostgreSQL locally because Docker/psql are unavailable.
- Current classification: MVP prerequisite for Core CRM. Registry/verifier code is reviewed locally; PostgreSQL 16 apply-from-zero and reapply proof remains pending in hosted CI. No manager or CRM endpoint may start until Gate 0 passes. Next owner: Codex to close hosted CI evidence before dispatching CRM-02.
