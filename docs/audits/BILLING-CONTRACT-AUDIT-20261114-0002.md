# Billing — source/contract audit checkpoint (2026-11-14)

- Repository: `delmacy/syndes-system`; authoritative main at inspection: `696f8e59a369dba593681e82293e104bef0a6e08`.
- Owner examined: Subscription & Billing (`modules/billing/AGENTS.md`, blob `5c5a5b5b2969e0c605d32dda15934c0ad0596c7c`). This checkpoint does not assert its catalog identifier; catalog mapping requires verification.
- Public business contract: plans, subscriptions, confirmed payments, delinquency and entitlements. Private responsibility: Billing computes entitlement; AI, WhatsApp and CRM consume it, not duplicate payment policy. Financial accounting for client businesses is explicitly outside scope.
- Temporal rules declared: `paid_until = payment_confirmed_at + 30 days`; late payment restarts from confirmation; D+0..D+10 full operation; D+11 AI N1 suspension; D+31 WhatsApp gateway suspension; preservation and automatic reactivation declared.
- Planned integrations: PSP card/Pix/boleto; authenticated, idempotent, audited webhooks; no full card storage. These are requirements, not verified implementations.
- Source existence: AGENTS.md verified. `modules/billing/package.json`, `modules/billing/README.md`, `modules/billing/src/index.ts` returned 404 at this SHA. This is **not** proof that implementation is absent elsewhere.
- Classes, DTOs, APIs, internal interfaces, emitted events, migrations and schemas: not inventoried/verified. Cross-owner consumers require separate inspection.
- Test specifications declared: payment confirmation, duplicate/out-of-order webhook, paid_until, D+10/D+11 and D+30/D+31 boundaries, reactivation, failed payment, PSP timeout, entitlement consistency, audit. No test execution; no test-success claim; CI evidence not checked.
- Runtime, database, deployment, homologation, GitHub Pages publication: not inspected or confirmed. DevServer not accessed.
- Audit boundary: documentation-only checkpoint; no code, SQL, secrets, workflow, migration, runtime or other branches modified. No merge. Source presence, test success and deployed state remain separate.
- Follow-up: locate catalog identifier and physical implementation across repository; inspect authorization, webhook signatures/replay, transactional idempotency, event and migration ownership; compare evidence by SHA before canonical documentation changes.
