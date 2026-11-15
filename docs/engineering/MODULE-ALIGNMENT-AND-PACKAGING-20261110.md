# Module Alignment and Package Distribution — Syndes

**Baseline:** 2026-11-10 • **Source of truth:** `delmacy/syndes-system` • **Reviewed main:** `afe057aa3028b61a0741feac71ab5b8d2ae9381e`  
**Purpose:** reconcile product delivery, modular architecture, npm package distribution and deployment without replacing the existing WBS. **Status: analysis, not a release authorization.**

## Governance / single plan

- Canonical program backlog: [WBS-PROGRAMA-SYNDES-20261110.md](./WBS-PROGRAMA-SYNDES-20261110.md). This document is a subordinate inventory, not another competing WBS.
- Product scope/order: `docs/product/MVP-SCOPE.md`, `docs/product/MODULE-ORDER.md`, root `AGENTS.md`. Functional order remains **Core CRM → Inbox → WhatsApp → Scheduling → AI → Documents → Email → Onboarding → Billing → Commercial Site**, with previously approved CRM/Inbox exceptions.
- Operations/Platform Manager/Support: follow their existing ADRs, WBS and security/release gates. Multi-organization remains blocked by SQL 002 until explicit gate approval.
- Distribution source: only `delmacy/syndes-system`. The separate private `delmacy/syndes-packages` repository and published `@delmacy/whatsapp@0.1.0` are an **experimental Meta Cloud API SDK**; do not assume parity with the authoritative Go/whatsmeow module, and do not overwrite either package.
- Runtime/deployment and packaging are separate: trusted NestJS modules loaded by Core Host; Go whatsmeow gateway built as container; shared TS SDKs separately only when real external consumers justify them. No parallel implementation or marketplace.
- `@syndes/*` is the **internal source naming convention**; GitHub Packages namespace cannot be claimed until an authorized GitHub owner/organization exists. If distributing through account `delmacy`, coordinate renaming/aliases and dependent lockfiles explicitly. Do not auto-rename internal packages.
- Package publication is **not** authorized just because `npm pack` passes: reproducible consumer installation, lockfiles, public API/semver, license policy, secrets audit, dependent packages, cross-tenant gates, package provenance and a separate release decision are required.
- No structural GitHub Actions change in this scope: centralized `syndes-ci.yml` is owned by the delegated CI workstream (`MAINLINE-CI-POLICY.md`).

## Modules inventory (evidence from reviewed main)

Counts of source/tests are indicative file counts, **not execution or product acceptance evidence**.

| Module | Files / package status | Evidence / boundary | Next review |
| --- | --- | --- | --- |
| Core CRM | `modules/core-crm`, private `@syndes/core-crm` | Packaged trusted NestJS module; canonical people/organizations; browser/OIDC/FGA and operational Product Gate still open (`README.md`, `CORE-CRM-MVP-ACCEPTANCE.md`) | **1** — functional gate and dependencies |
| Inbox | `modules/inbox`, private `@syndes/core-inbox` | Installed via Core Host; CRM FK/tenant checks, Inbox UI and simulator; real channel authorization/release evidence required (`README.md`, `PRD-002-INBOX-ACCEPTANCE.md`) | **2** |
| WhatsApp | `modules/whatsapp`, private `@syndes/whatsapp` + `gateway/whatsmeow` | Go gateway, TS module, SQL, inbound/outbound path; security/multi-org/real-number gates still open (`README.md`, `AGENTS.md`) | **3** — detailed slice below |
| Scheduling | `modules/scheduling` scaffold | No standalone package/code confirmed in this audit | **4** — PRD after preceding gate |
| AI First-Level Assistant | `modules/ai-assistant` scaffold | No standalone package/code confirmed | **5** |
| Documents | `modules/documents` scaffold | No standalone package/code confirmed | **6** |
| Email | `modules/email` scaffold | No standalone package/code confirmed | **7** |
| Onboarding | `modules/onboarding` scaffold | No standalone package/code confirmed | **8** |
| Billing | `modules/billing` scaffold | No standalone package/code confirmed | **9** |
| Commercial Site | `modules/commercial-site` scaffold | No standalone package/code confirmed | **10** |
| Organizations | `modules/organizations`, private `@syndes/core-organizations` | Cross-cutting tenant/org/workspace boundaries; SQL 002 remains on; multi-org requires independent Product Gate (`README.md`) | Transversal P0; not another MVP module |
| Support | `modules/support`, private `@syndes/core-support` | Support for internal Syndes tenant; requires separate acceptance/release gates and account provisioning (`README.md`, `WBS-SYNDES-SUPPORT.md`) | Approved cross-cutting stream |
| Platform Core | `modules/platform-core` scaffold | Real cross-cutting runtime lives in `packages/core-kernel`, `apps/core-host` and `infra`; do not assume this scaffold is the service | Architecture only |

Common packages: `packages/core-kernel` and `packages/front-shared` are both `private: true`; `front-shared` exports TSX source, not a ready-to-publish compiled browser package. Keep shared **UI primitives only**, with separate manager/tenant auth contexts.

## WhatsApp — module-by-module review #1 (2026-11-10)

### Verified source structure

- `modules/whatsapp/src`: accounts, provider-independent contracts, NestJS plugin/HTTP, inbound handlers, persistent outbox, dispatch and worker, outbound relay/reply, group/avatar/contact features and scope checks.
- `modules/whatsapp/gateway/whatsmeow`: Go provider gateway with `go.mod` and Dockerfile.
- `modules/whatsapp/sql` and `modules/organizations/sql`: tenant/org schemas, owner constraints, rollout gates.
- `apps/core-host/config/modules.json` **already lists** `@syndes/whatsapp/plugin`; `apps/core-host/package.json` links `@syndes/whatsapp` by `file:../../modules/whatsapp`. Earlier passages of the WhatsApp README saying "not mounted" are historical and must not be interpreted as the current source state.
- `scripts/ci/plan.mjs` recognizes `whatsapp-ts` and `whatsapp-go` and propagates changes to Inbox/Host/Workspace; `run-suite.sh` runs TS tests and a package dry-run. **No second publishing pipeline should be created.**

### Alignment and non-negotiable contracts

1. **One source:** provider-neutral domain/contracts in `modules/whatsapp`; Go/whatsmeow is the initially approved gateway. The experimental Meta Cloud API SDK does not replace it; it may become a separately reviewed adapter/SDK later.
2. **Security:** server-verified tenant, account and org/workspace binding; no user-selected tenant DB, policy bypass, or broad bearer token accepted as account authority. Cross-org/tenant negative tests required.
3. **Send path:** persisted outbox, idempotency, per-account 40/min reservation, priority, retry/recovery and uncertain-result reconciliation before live enablement. Status/delivery and audit must be verified end-to-end.
4. **Receive path:** authenticated versioned inbound event, account-owner lookup, deduplication by external message ID, projection to CRM identities and authorized Inbox. Account and workspace ownership must hold at every stage.
5. **Release:** SQL 002 single-context gate remains active until the independent multi-org gate; no migrations or live gateway switching as part of packaging.

### Packaging blockers confirmed

| ID | Evidence | Required acceptance |
| --- | --- | --- |
| WA-PKG-01 | `modules/whatsapp/package.json` is `private: true` | Keep private until approved versioned distribution/public API and legal/license review |
| WA-PKG-02 | `@syndes/core-kernel: file:../../packages/core-kernel` | Replace local-only dependencies in a **release artifact**, validate consumer install with pinned published internal dependencies |
| WA-PKG-03 | `@syndes/whatsapp` vs GitHub account namespace `@delmacy` | Decide owner/organization and migration strategy without breaking Core Host imports |
| WA-PKG-04 | Exports `.`, `./contracts`, `./plugin` but no versioned `.d.ts` export mapping in manifest | Validate packed JS/types, SQL/gateway assets, Node/Nest consumer, peer dependencies and backward compatibility |
| WA-PKG-05 | Experimental `@delmacy/whatsapp@0.1.0` already published with different Meta API behavior | Preserve as experimental; do **not** publish the authoritative implementation under the same package/version |
| WA-PKG-06 | Go gateway is a separate runtime (not importable as npm package) | Build/test/version as independent container image, deployed only after security/runtime gates |

### Integration / operations blockers carried from WhatsApp README and WBS

- Verify the **actual current** inbound HTTP receiver, route bindings, callback auth and end-to-end projection in Core Host and Inbox; README mixes historical phase reports with newer code.
- Run TypeScript, Go, disposable PostgreSQL, tenant A/B and cross-org/workspace negative tests on the current merged SHA; test listing is not proof they pass.
- Confirm pairing/reconnect, account provisioning, rate limit, worker leases/recovery, dead-letter/manual reconciliation, inbound+outbound receipts/media, health, logs and real-number acceptance.
- Do not enable multi-org/multi-workspace or relax SQL 002; do not alter host/container releases before a verified rollout/rollback.

### Executable work order (link to canonical WBS)

| Step | Task | Evidence / definition of done |
| --- | --- | --- |
| A0 | Freeze source-of-truth and mark experimental SDK | README / inventory, no parallel development |
| A1 | Verify CRM Product Gate and Inbox contract dependencies | Existing product acceptance docs + current CI/release evidence |
| A2 | Audit WhatsApp public surface and transitive dependencies | export map, consumers, packaged artifact, type/runtime checks |
| A3 | Run authoritative TS/Go/PostgreSQL/authorization test matrix | exact main SHA, CI links, negative tenant/org cases |
| A4 | Close live security/worker/callback gaps | reproducible E2E results with vetted deployment candidate |
| A5 | Prepare release-only naming and internal registry dependencies | consumer `npm ci` and imports from GitHub Packages without local paths |
| A6 | Extend existing CI release stage (delegated CI stream) | semver/release gate, explicit promotion, artifact provenance |
| A7 | Build separate gateway container artifact and stage via Dokploy | pinned digest, secrets, smoke and rollback |
| A8 | Approve Product Gate before declaring DONE | linked tests, signed-off security and operational evidence |

## What this review did / did not do

- Reviewed **main source structure and product/engineering documentation**, not production state; no deploy, SQL migration, code refactor, package publish or CI modification.
- Modules 2–10 remain **inventory-level only**; they must be reviewed sequentially against their Product Gate and contracts before implementation changes.
- Update this document and the existing program WBS together as gates are verified, with SHA and links. Avoid counting a file, test name or green compilation as proof of DONE.
