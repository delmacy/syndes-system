# Q09 — Infra Tests | source-boundary audit (2026-11-14 22:01 BRT)

- **Repository:** delmacy/syndes-system
- **Baseline main:** `1cf48cc0a1281017ac58f7b9b9747f663109e151` (verified against main immediately before audit)
- **Audit branch:** `audit/q09-infra-tests-source-20261114-2201`
- **Owner:** Q09, `tests/platform` per `docs/subprojects/Q09-infra-tests/README.md`.
- **Result:** partial static source inspection; **not** a test pass, deployed verification, or homologation.

## Evidence inspected
- `docs/subprojects/Q09-infra-tests/{README,STATUS,ESCOPO,REFERENCIA-TECNICA,OPERACAO}.md`; status explicitly says *SEM AUDITORIA FUNCIONAL*.
- GitHub contents listing of `tests/platform`: 17 files (shell, Python and MJS), including PostgreSQL, OpenFGA, OpenBao, Core Host, Manager, secrets and Support migration checks.
- `tests/platform/platform-manager-network-smoke.py`: invokes four other Python tests; validates Compose JSON, expected network membership, loopback frontend binding and absence of API host ports; then **creates Docker networks and containers, pulls images and removes fixtures** to test bridge isolation. It is **not read-only** and must not be executed on DevServer under this audit's restrictions.
- `tests/platform/platform-manager-host-gate.sh`: host-specific Docker inspections and SQL SELECT queries, Keycloak/OpenBao/Tailnet checks, health probes and exit codes 0 (pass), 1 (warning), 2 (blocked). Requires operational authorization; **not executed**. Its `docker exec` probes and SELECTs do not establish that it was run or that the host is healthy.
- `tests/platform/support-migration-gate.test.sh`: synthetic negative checks for missing, invalid and mismatched Support tenant IDs and a positive allowlist; grep assertions check installer calls gate. **No database migration executed**.
- `tests/platform/ci-secret-fixtures.py`: writes synthetic runtime fixture files under `/run/syndes/runtime` with directory mode 0700 and individual file mode **0644**. Review fixture file permissions and runtime scope; 0644 is readable by other users with directory traversal access. This is a **potential hardening concern**, not evidence of exposed production secrets.

## Contracts and boundaries
- **Public contract:** executable script entrypoints, exit status, stdout summaries and documented test expectations; not a package `exports` API.
- **Private implementation:** helper functions and local Python/Bash internals; no Q09-owned HTTP endpoints, domain events, UI, database schemas or migrations established in examined files.
- **Dependencies:** Q09 validates contracts owned by I04/I05, A02/A05, C03/C04/C05, P06 and others; it does **not** own those implementations. SQL referenced by host gate is an operational query, not a Q09 migration.
- **Source exists ≠ test succeeded ≠ deployed/homologated**. Compose assertions prove intended configuration only when run successfully; ephemeral Docker network tests do not prove production firewall isolation.

## Findings / gaps
1. **Q09-01 (evidence):** no test-run output, CI run+SHA mapping, or deployed host verification collected in this audit; keep Q09 status unverified.
2. **Q09-02 (safety boundary):** network smoke creates/pulls/removes Docker resources; do not describe it as read-only and do not execute on DevServer under current constraints.
3. **Q09-03 (review):** synthetic CI secret fixture files are chmod 0644. Assess whether any execution environment permits unintended file traversal; no production leakage established.
4. **Q09-04 (coverage):** remaining 13 files in `tests/platform` were inventoried by name, not individually inspected; assertions, mocks, negative cases, CI wiring and actual execution must be traced before claiming full coverage.
5. **Q09-05 (documentation):** Q09 reference remains generic and STATUS lacks functional audit; do not promote states until reviewed evidence is reconciled.

## Tests and operational actions not performed
No tests run; no Docker, SQL, migration, secrets, DevServer, runtime, CI workflow, deploy, merge or Pages publication actions. No external branches modified.

## Next review gates
Inspect remaining Q09 scripts and test assertions, map each requirement to executable CI job and exact SHA, verify negative-path coverage and fixture permissions, then reconcile STATUS/technical chapters via separate documentation review. Reconcile the 57 catalog units plus discovered owners, Q07/Q08 open findings and public GitHub Pages build SHA before declaring global completion.
