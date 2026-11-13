## 0. Endereços exatos de leitura

- Catálogo: `catalog/work-units.json`, C04 em `infra/security-access/fga-model.json`.
- Modelo: `infra/security-access/fga-model.json` (schema 1.1).
- Provider e migrations do serviço: `infra/security-access/compose.yaml`.
- Owner A04: `apps/core-host/src/adapters.ts`, `main.ts`, `platform-event-service-grant.ts`, `platform-event-worker-admission.ts`.
- Owner A06: `apps/account-access-api/src/auth.mjs`.
- Testes: `apps/core-host/test/adapters.test.mjs`, `platform-event-service-grant.test.mjs`, `platform-event-service-grant-fga.test.mjs`; `apps/account-access-api/test/auth.test.mjs`.
- ADR/WBS: `docs/engineering/ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`, `WBS-EVENTS-OPENFGA-SERVICE-20261111.md`.
- STATUS: `docs/subprojects/C04-authorization-openfga/STATUS.md`.
