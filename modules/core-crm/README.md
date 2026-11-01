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
