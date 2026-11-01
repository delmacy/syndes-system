# Syndes Core CRM — vertical slice 1

A **business module**, not a framework dependency. The CRM is the canonical source of Person and Organization records. User login identities remain in Keycloak and are **never represented as Person**. WhatsApp push names must not silently overwrite CRM records.

## Delivered
- Independent `@syndes/core-crm` private TypeScript package implementing `ModuleDefinition`.
- Create organizations and people; relate people to organizations; create tags, assign tags to people, add notes, and read an audited person timeline. List/search/get/archive people. Searches include person name/email/phone, linked organization names/CNPJ and tags.
- Email/phone normalization; archive instead of destructive deletion.
- Mandatory CoreKernel execution before a tenant repository is resolved.
- PostgreSQL migrations `sql/001_crm_foundation.sql` and `sql/002_crm_tags_notes.sql` for each isolated tenant database, plus `tenant_id` checks and atomic audit logs.
- Tests for permissions, data normalization and tenant routing.

## Intentional constraints
**This first vertical slice is not the full PRD-001 Product Gate.** Remaining work: HTTP/UI integration, onboarding-backed tenant database credentials, automated migration orchestration and realistic multi-tenant E2E. Employee, ChannelIdentity, CSV import/export and duplicate alerts are implemented and covered by domain/SQL tests. The module is now **registered** in the NestJS Core Host composition root. No production CRM routes are enabled until a trusted tenant DB provider is wired and tested.

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
