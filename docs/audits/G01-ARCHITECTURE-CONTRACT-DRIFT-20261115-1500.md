# G01 — Architecture contract/source boundary (2026-11-15 15:00 BRT)

Base: public main `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Scope: catalog G01 `docs/engineering`; read-only GitHub MCP inspection, no DevServer.

## Source versus decision

- **G01-01 — documentation drift (confirmed):** `docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md`, section 5, describes `apps/workspace-web/src/App.tsx` as defining menu/views manually and section 8 directs decomposition. Current `apps/workspace-web/src/App.tsx` delegates rendering to `WorkspaceShell`, navigation to `useHashView`, scope handling to `useActiveWorkspace`, and disposes scoped API clients on root change. The ADR's historical baseline is explicitly `f537b2b...`; its status table must be updated or labeled as historical before being used as current architecture evidence. This is a documentation mismatch, **not** proof that scope-switching, authorization or browser tests pass.
- **G01-02 — runtime admission boundary:** `apps/core-host/src/platform-event-worker-composition.ts` constructs bridge, dispatcher and three subscriptions (`whatsapp.message.received.v2`, `inbox.participant.observed.v1`, `crm.person.resolved.v1`), but explicitly does not start workers, routes, schedulers or ingress. Declared event integration is not activated deployment.
- **G01-03 — control versus tenant events:** `packages/core-kernel/src/control-plane-events.ts` exports `ControlPlaneModuleEvent`, `validateControlPlaneEvent` and two control module event types. `docs/engineering/ADR-PLATFORM-EVENTS-20261111.md` assigns tenant events to each tenant DB's `platform_events`; `ADR-CONTROL-PLANE-EVENTS-20261111.md` assigns global administrative events to `syndes_control.control_events`. No shared tenant business event queue is authorized.
- **G01-04 — trusted plugin list:** `apps/core-host/config/modules.json` lists CRM, Inbox, WhatsApp, Organizations and Support plugins. This is a compilation/mounting declaration, not proof of ENABLED entitlement, database migration, tenant authorization or release.

## Contracts and evidence boundary

Public architectural contracts: two trust-separated frontends, tenant-isolated PostgreSQL databases, backend modules and core-kernel ports, service identity admission, no browser-controlled DB selection. Private/internal examples: Nest composition factory, trusted plugin config, event validator. No G01-owned HTTP endpoint, class, event producer or migration was established from the G01 document directory; referenced implementations belong to their respective owners. ADRs describe proposed and implemented states at different baselines and must not be treated as live deployment evidence.

Files inspected at main: `catalog/work-units.json`, `scripts/architecture/check-work-units.mjs`, `AGENTS.md`, `docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md`, `docs/engineering/ADR-PLATFORM-EVENTS-20261111.md`, `docs/engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md`, `apps/core-host/src/platform-event-worker-composition.ts`, `apps/core-host/config/modules.json`, `packages/core-kernel/src/control-plane-events.ts`, `apps/workspace-web/src/App.tsx`.

## Not run / not established

No tests, build, SQL, migration, workflow, deploy, Docker or DevServer access. No CI SHA verification, operational TLS/FGA, worker activation, PostgreSQL schema installation, browser E2E, homologation or GitHub Pages published SHA verification. No assertion of zero divergences or 57-unit completion. Documentation-only checkpoint; G01-01 remains open for independent reconciliation and tests. No changes to another writer's branch.
