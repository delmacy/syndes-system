# Syndes Core CRM — packaged application module

A **business module**, not a framework dependency. The CRM is the canonical source of Person and Organization records. User login identities remain in Keycloak and are **never represented as Person**. WhatsApp push names must not silently overwrite CRM records.

## Delivered
- Independent `@syndes/core-crm` private TypeScript package with a trusted `./plugin` descriptor implementing `defineSyndesModule`.
- Create organizations and people; relate people to organizations; create tags, assign tags to people, add notes, and read an audited person timeline. List/search/get/archive people. Searches include person name/email/phone, linked organization names/CNPJ and tags.
- Email/phone normalization; archive instead of destructive deletion.
- Mandatory CoreKernel execution before a tenant repository is resolved.
- SQL migrations 001–003, packaged under the module manifest, applied by the generic operator migration runner to each isolated tenant DB, plus tenant ID checks and atomic audit.
- Tests for permissions, data normalization and tenant routing.

## Intentional constraints
**The CRM module packaging gate is complete; product/security release gates remain open.** The package owns its NestJS API module, browser UI assets, SQL migration manifest and permission declarations. The Core Host loads it from its trusted installed-module config without CRM-specific routes. Production onboarding, live OIDC+OpenFGA browser validation, backup/restore and authorization tuple provisioning remain separate release gates.

Use `npm ci && npm test` in this package after building `packages/core-kernel`.

## Usage
```ts
import { CrmService, crmModule, PgCrmRepositoryFactory } from "@syndes/core-crm";

const kernel = new CoreKernel({
  modules: [{id:"platform",version:"0.1.0"},crmModule],
  tenancy: membershipAdapter,
  authorization: openFgaAdapter,
});
await kernel.start();

const repos = new PgCrmRepositoryFactory(trustedTenantDatabaseProvider);
const crm = new CrmService(kernel, id => repos.forTenant(id));
await crm.createPerson({actor:verifiedActor,tenantId:verifiedTenantId},{name:"Ana",email:"ANA@example.com"});
```

Tenant database credentials **must** be selected by the trusted provider using the verified control-plane registry, never via a user-supplied database name. The generic Core Host mounts the exported `@syndes/core-crm/plugin` descriptor; actual per-tenant production credentials are supplied during audited onboarding.


## Leitura de vínculos CRM no contexto da Inbox

Os endpoints `GET /v1/tenants/:tenantId/crm/people/:id/organizations` e `/tags` expõem somente os relacionamentos existentes **da pessoa no tenant autenticado**, sem modificar dados. O primeiro exige `crm:organizations/read` e o segundo `crm:tags/read` antes da seleção do banco. Os JOINs incluem `tenant_id` e excluem pessoa arquivada e organizações arquivadas. Sem alterações de schema, migração ou autorização implícita a partir de leitura de Inbox.

## Capabilities e novos endpoints de gestão do Workspace

- ``GET /crm/capabilities`` consulta permissões por recurso via Core Kernel/OpenFGA, usando ator e tenant verificados. No Stage C1, a rota **também resolve o banco confiável** para verificar membership de Organização/Workspace e auditoria do backfill, antes de listar capacidades. Retorna falso para ações FGA negadas e 403 para ausência de acesso ao contexto.
- ``GET /crm/people?limit=25&offset=25&q=...`` e ``/organizations``: paginação consistente por nome/ID e offset validado (0–100000) **no PostgreSQL do tenant**.
- ``GET /crm/tags``: catálogo do tenant para reutilização de tags.
- ``DELETE /crm/people/:id/tags/:tagId`` e ``/organizations/:organizationId``: desvinculação autorizada/auditada, sem exclusão dos registros canônicos.
- ``GET /crm/people/:id/employee``: consulta pontual de perfil de funcionário do contato, sem listar funcionários de outros contatos.

Sem mudança de schemas ou de política por conveniência do frontend. A permissão backend existente é por recurso ``read/write``, não por operação CRUD detalhada. Para concluir a homologação de UI, veja `docs/product/CORE-CRM-FRONTEND-COMPLETION.md`.


## Stage C1 — CRM default organization/workspace HTTP entry gate

The Core Host CRM API now requires **crm:context/read** (a newly declared
OpenFGA resource) plus tenant membership, active membership in the default
Platform Organization and Workspace, and a completed audited legacy owner
backfill. All CRM HTTP endpoints, including search/CSV, pass through this
gate before CRM business SQL executes; unauthorized actors get 403.

**Release prerequisite:** first migrate the trusted tenant database through
platform organizations 001, 002 and 003; bootstrap as approved administrator;
run the authenticated default-context/backfill endpoint at least once; then
provision crm:context/read for the intended CRM roles via trusted OpenFGA
administration. Only deploy the new CRM Host after these steps, otherwise
legitimate existing users will receive 403. No production deployment has
been performed.

This is *not* full multi-org. The temporary 002 SQL UNIQUE indexes prevent
a second organization/workspace. CRM repository SQL is still tenant-only and
direct repository/WhatsApp calls are not covered by this HTTP-only gate.
Do not remove the indexes until per-record organization/workspace SQL filters,
imports/exports, nested reads/writes, service calls and channel isolation have
passed the separate Stage C2 security gate. The publishing term Site remains
reserved; an operational branch is a Unit.


## Stage C2a — Organization-parameterized SQL repository

When used through the Core Host HTTP controller, the authorized
organizationId from CrmDefaultContextGuard is forwarded into
PgCrmRepository and PgCrmExtras. Reads, mutations, nested associations,
searches, timeline, employees, channels and CSV exports filter by the
platform organization in parameterized PostgreSQL statements. Person,
CRM contact-company, tag and batch-import writes insert that owner
explicitly.

The source-controlled SQL scope markers require an owner placeholder on
every scoped SQL statement; a missing marker or malformed owner ID fails
closed before querying. Existing tenant-only domain callers remain
supported while the temporary one-org SQL indexes are installed, because
Inbox/WhatsApp direct integrations have not yet migrated. Do NOT remove
those indexes, claim workspace-scoped CRM visibility, or enable multi-org
before Stage C3 and cross-module tests.

Cross-company negative integration lives in
modules/organizations/test/pg-crm-org-scope.test.mjs, which temporarily
lifts the indexes ONLY in a disposable PostgreSQL test schema.
