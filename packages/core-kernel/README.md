# @syndes/core-kernel (foundation)

A dependency-light TypeScript kernel for modular business applications. It does **not** implement CRM, WhatsApp, tenancy storage, or identity itself.

## Architecture
- **Core:** module manifest, dependency resolution, sequential startup, server-side request enforcement.
- **Modules:** install statically using a versioned `ModuleDefinition` contract; module APIs and business data stay outside the kernel.
- **Adapters (host-owned):** `TenancyPort` and `AuthorizationPort`. The Syndes NestJS host will supply PostgreSQL tenant membership, Keycloak authentication and OpenFGA authorization adapters.
- **Deploy:** one NestJS host process may contain many modules; separating a container is a later operational choice, not a requirement.

```ts
import { CoreKernel } from "@syndes/core-kernel";

const kernel = new CoreKernel({
  modules: [
    { id: "identity", version: "1.0.0" },
    { id: "crm", version: "1.0.0", dependencies: ["identity"] },
  ],
  tenancy: { canAccessTenant: async ({ actor, tenantId }) => membershipService.check(actor, tenantId) },
  authorization: { canAccess: async (query) => policyService.check(query) },
});
await kernel.start();
await kernel.execute({ actor: verifiedActor, tenantId: verifiedTenantId,
  action: "person.read", resource: "person:42" }, async () => crm.findPerson("42"));
```

**Security:** `verifiedActor` and `verifiedTenantId` MUST come from trusted server-side authentication and tenant resolution, never directly from client input. Adapters are required and deny by default. Domain routes must call the kernel/guards for every protected operation; this package alone cannot protect a route it never sees.

## CI and packaging

```sh
npm ci
npm run check
npm test
npm pack --dry-run
```

The package is currently **private**. Before external publication, explicitly choose a license, contributor governance, package ownership, threat model and versioning/release policy. No dynamic loading of untrusted plugins, marketplace, workflow engine or API exposure is included.
