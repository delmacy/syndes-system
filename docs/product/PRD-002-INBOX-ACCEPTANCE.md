# PRD-002 — Core Inbox Development Acceptance

**Status:** Development implementation in progress (not production release).

## Approved journey

1. Authenticate through Keycloak with PKCE and authorize a canonical tenant.
2. Create a simulated conversation, optionally linking an existing CRM person in the **same** tenant.
3. Receive an inbound simulator message with a stable external message ID.
4. View chronological history and queue; assign conversation to an attendant.
5. Reply as assigned attendant; record a private internal note.
6. Transition open → pending → resolved; new inbound message reopens the thread.
7. Transfer assignment or change human/bot handoff; inspect basic metrics.
8. Verify tenant B cannot resolve, read or mutate tenant A's identifiers, and policy denial occurs before database resolution.

## Product Gate

- [x] Domain contract and PostgreSQL persistence belong to Inbox package.
- [x] Descriptor via `defineSyndesModule` with CRM dependency, migrations, permissions and assets.
- [x] Authenticated HTTP controller and responsive browser UI implemented.
- [x] Simulator supports idempotent inbound messages, no direct WhatsApp dependency.
- [x] Automated unit and disposable PostgreSQL integration tests committed.
- [ ] GitHub Actions green **on this PR head** (verify runs).
- [ ] Browser acceptance with real Keycloak client and tenant grants.
- [ ] Push realtime/attachments if required under the local Inbox AGENTS.md for full MVP gate.
- [ ] Operational secrets/recovery/hardening and production rollout (homologation).

No checklist is a substitute for reviewed CI evidence. Do not merge any chained PR automatically.
