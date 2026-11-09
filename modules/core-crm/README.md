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
**The CRM development gate is complete.** The package owns its NestJS API module, browser UI assets, SQL migration manifest and permission declarations. The Core Host loads it from its trusted installed-module config without CRM-specific routes. Production onboarding, live OIDC+OpenFGA browser validation, backup/restore and authorization tuple provisioning remain separate release gates.

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

- ``GET /crm/capabilities`` consulta as permissões ``read/write`` por recurso via Core Kernel/OpenFGA, usando ator e tenant verificados. Retorna falso quando uma capacidade é negada e falha fechada em indisponibilidade do FGA. Não abre conexão de banco para esta consulta.
- ``GET /crm/people?limit=25&offset=25&q=...`` e ``/organizations``: paginação consistente por nome/ID e offset validado (0–100000) **no PostgreSQL do tenant**.
- ``GET /crm/tags``: catálogo do tenant para reutilização de tags.
- ``DELETE /crm/people/:id/tags/:tagId`` e ``/organizations/:organizationId``: desvinculação autorizada/auditada, sem exclusão dos registros canônicos.
- ``GET /crm/people/:id/employee``: consulta pontual de perfil de funcionário do contato, sem listar funcionários de outros contatos.

Sem mudança de schemas ou de política por conveniência do frontend. A permissão backend existente é por recurso ``read/write``, não por operação CRUD detalhada. Para concluir a homologação de UI, veja `docs/product/CORE-CRM-FRONTEND-COMPLETION.md`.
