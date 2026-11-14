# Q05 — Security source boundary audit (2026-11-14 18:00 BRT)

## Immutable baseline and scope
- Repository: `delmacy/syndes-system`; inspected main SHA `1cf48cc0a1281017ac58f7b9b9747f663109e151`.
- Unit: Q05 Segurança; documentation owner source points to `tests/security`.
- GitHub recursive tree returned without truncation. Under `tests/security/` the **only tracked entry** is `AGENTS.md`; no executable suite, manifest or fixture exists at that exact catalog source path.
- This is an evidence gap, **not** proof that the repository has no security tests.

## Normative and actual contracts
- `tests/security/AGENTS.md` requires tenant isolation, authorization, ID tampering, webhook authenticity/idempotency, upload validation, secret leakage, AI-tool authorization/prompt-injection and session/access boundary tests. Cross-tenant violation is a release blocker; UI hiding does not establish authorization.
- `docs/standards/CONTRATOS-PUBLICOS.md` requires owner-controlled public exports and distinguishes HTTP APIs, ports, events, infrastructure and quality gates.
- Q05 has no demonstrated independent runtime package, public API, class, event producer/consumer, frontend, database schema or migration at its catalog source. No such ownership is inferred from adjacent code.
- `modules/support/test/security.test.mjs` is an **actual separate owner test suite**. Static assertions cover wrong-tenant rejection before FGA/DB, fail-closed FGA denial/outage, trusted DB mismatch, verified requester identity, cross-capability permissions, tenant/queue SQL filters, internal-note filtering and invalid IDs. It uses an in-memory mocked kernel/provider and imports built `dist` artifacts; it is **not** evidence of a real DB, HTTP ingress, Keycloak/OpenFGA integration or deployed protection.
- `infra/security-access/compose.yaml` declares internal networks and no published host ports for Keycloak/OpenFGA/OpenBao. This is I12/security-infrastructure configuration evidence, not Q05 runtime ownership or proof of deployed policy enforcement.
- `docs/subprojects/Q05-seguranca/STATUS.md` accurately says no functional audit; `REFERENCIA-TECNICA.md` identifies `tests/security` but its broad placeholders must not be interpreted as implemented functionality.

## Evidence and outstanding gates
- **Tests executed this audit:** none. No CI/workflow was run or modified. No runtime, DevServer, migrations, SQL, credentials or deployment accessed.
- **Test success for current SHA:** not verified. **Deployment/homologation:** not verified. **Public GitHub Pages published SHA:** not verified.
- Material gap Q05-GAP-01: normative security checklist has no executable tests at its declared owner path. Existing tests elsewhere must be mapped individually to the checklist, with missing negative cases tracked rather than counted as covered.
- Material gap Q05-GAP-02: Support mocked assertions cannot establish real enforcement; require independent integration/security evidence linked to exact commit SHA.
- Boundaries: no public/private API, event, class or schema may be assigned to Q05 without source ownership evidence. No claim of zero divergences across the 57-unit catalog is made.
- Next audit: Q06 or next unexamined catalog owner after verifying current branches and integrated checkpoints. Documentation integration, review gates and Pages SHA remain pending.
