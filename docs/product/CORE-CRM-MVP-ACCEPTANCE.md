# Syndes — Core CRM MVP: development acceptance

> **Estado do produto (2026-11-01): INCOMPLETO.** Esta página registra principalmente aceitação técnica de domínio, API, persistência e UI legada. **Não** representa conclusão da experiência CRM no novo Workspace, cujos formulários, relacionamentos, ações por capacidade, usabilidade e testes com perfis diversos ainda precisam de trabalho. Por decisão do responsável pelo produto, a Inbox passou a ser o foco de desenvolvimento, mantendo esse débito de CRM aberto. Ver `docs/product/WORKSPACE-MVP-HANDOFF.md`.

The Core CRM is a standalone business module of the reusable TypeScript `@syndes/core-kernel`; the NestJS Core Host is its composition root. It does not require one server process per CRM module.

## Completed MVP capabilities

- [x] Canonical Person and Organization creation, read/search, editing, archived (soft-delete) records
- [x] Person ↔ Organization links with composite tenant-aware foreign keys
- [x] Employee profile independent from Keycloak login
- [x] Tags, notes and audit-backed person timeline
- [x] Channel identities (WhatsApp, Instagram, email) linked to Person, without overwriting confirmed CRM names
- [x] Search by person name, phone, email, linked organization name, CPF/CNPJ representation and tags
- [x] Simple duplicate warnings by email and phone scoped to tenant
- [x] RFC4180-style, bounded CSV import (500 rows, 1 MiB), and CSV export (1,000 records) protected against formula injection
- [x] Authenticated HTTP routes under `/v1/tenants/:tenantId/crm/*`
- [x] UI legada de desenvolvimento sob `/crm` com OIDC/PKCE; **a UI do CRM dentro de `apps/workspace-web` segue incompleta e não tem Product Gate aprovado**
- [x] OpenBao-scoped tenant PostgreSQL credential retrieval and trusted Control DB registry; no user-supplied connection strings
- [x] Schema migrations 001–003 with repeatable operator script, executed as tenant DB owner
- [x] Audit records for all domain changes; no audit writes without the associated mutation

## Verified by automated tests

- Unit: module registration, validation, contacts/organizations/tags/notes, tenant checks, denial before any database resolver, CSV parsing and escaping.
- SQL: real PostgreSQL migrations (repeatable), employee/channel/notes/tag relationships, audit and ownership.
- Acceptance: TWO physically distinct PostgreSQL tenant databases, separate roles, blocked B→A connections, distinct records, complete CRM journey.
- HTTP: NestJS route wiring rejects unauthenticated requests and cross-tenant access, permits authorized requests under a test host.
- App infrastructure: Core Host Docker build, PostgreSQL and Security and Access integration, OpenBao and OpenFGA checks.

Run the relevant workflows in GitHub Actions:
`Core CRM CI` and `Core Host and Infrastructure CI`. Both must be green on the PR head before the development acceptance is considered valid.

## Operational prerequisites, not part of the development gate

Actual production access requires:
1. Provision the approved tenant DB and run `infra/postgres/bootstrap/migrate-crm-tenant.sh` as an authorized operator. Tenant-role passwords are never selected by HTTP clients.
2. Store `username` and `password` in OpenBao KV v2 `kv/production/tenants/<tenant-uuid>` and mount the dedicated Core Tenant DB AppRole credentials.
3. Mark the tenant active in `syndes_control` and create approved tenant memberships.
4. Create FGA store/model and grant relevant resource tuples for CRM resources `crm:organizations`, `crm:people`, `crm:relationships`, `crm:tags`, `crm:notes`, `crm:employees`, `crm:channels`. Use the existing tenant-scoped SHA-256 mapping; never grant all tenants automatically.
5. Configure an approved Keycloak public client `syndes-crm-ui` with PKCE S256, permitted redirect `https://<host>/crm`, trusted web origins, and a proper access token audience `syndes-core`.
6. Complete a live browser/OIDC/FGA journey and operational recovery testing on a staged environment before real customers.

**Development completion is not production authorization.** The infrastructure PR #5 and kernel PR #4 must be merged in order before this stacked PR is released. No real tenant database credentials, customer records or server stacks were changed by these development PRs.

## Intentionally out of scope

Pipeline/deals, AI in the CRM domain, custom fields, forecasting, marketing automation, dynamic untrusted plugins and production disaster recovery enhancements.
