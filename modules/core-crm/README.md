# Syndes Core CRM — vertical slice 1

A **business module**, not a framework dependency. The CRM is the canonical source of Person and Organization records. User login identities remain in Keycloak and are **never represented as Person**. WhatsApp push names must not silently overwrite CRM records.

## Delivered
- Independent `@syndes/core-crm` private TypeScript package implementing `ModuleDefinition`.
- Create organizations and people, assign relationships, list/search/get/archive people.
- Email/phone normalization; archive instead of destructive deletion.
- Mandatory CoreKernel execution before a tenant repository is resolved.
- PostgreSQL migration `sql/001_crm_foundation.sql` for each isolated tenant database, plus `tenant_id` checks and atomic audit logs.
- Tests for permissions, data normalization and tenant routing.

## Intentional constraints
**This first vertical slice is not the full PRD-001 Product Gate.** Remaining work: employee/tag/note/timeline/channel identity, CSV validation/import/export, duplicate alert, search by tags/CNPJ/organization, UI/HTTP API, onboarding-backed tenant database credentials, migration automation and realistic multi-tenant E2E. The module is now **registered** in the NestJS Core Host composition root. No production CRM routes are enabled until a trusted tenant DB provider is wired and tested.

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

Tenant database credentials **must** be selected by the trusted provider using the verified control-plane registry, never via a user-supplied database name. The Core Host already registers `crmModule`; the tenant-scoped connection provider and authenticated HTTP routes are intentionally deferred until their isolation tests are ready.
