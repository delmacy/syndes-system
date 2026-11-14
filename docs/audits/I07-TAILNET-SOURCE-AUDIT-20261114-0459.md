# I07 Tailnet — source/contract audit checkpoint (2026-11-14 04:59 BRT)

- Repository: `delmacy/syndes-system`
- Immutable audited main: `39f434e5720653eda8af2e3b2a0fa60d1a119cdd`
- Owner: `I07 Tailnet` (`catalog/work-units.json`: maturity `partial`, documentation parent `I02`). This is catalog metadata, **not** evidence of deployment or acceptance.
- This checkpoint is documentation-only. No runtime, migrations, credentials, product CI/workflows, or other writers' branches touched.

## Sources and concrete contracts

1. `infra/master-admin/check-tailnet-route.py` (blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`) is a read-only, fail-closed JSON checker of Tailscale Serve configuration. CLI `--mode free|active`, optional port (default 9447), fixed allowed target `http://127.0.0.1:18085`. Invalid JSON, port, target or mappings exit 2.
2. In `free` mode, rejects any allocation of the dedicated TCP/Web port. In `active` mode, requires a unique Web hostname on the port, `TCP[port].HTTPS is True`, exactly the root handler with exact proxy target, and rejects `AllowFunnel[hostname] is True`. It does not print hostnames.
3. `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` (blob `c440d1c157c3b63fb552b255c22e3b80ae0d8983`) documents **different** Workspace/Keycloak Tailnet HTTPS ports (9443/9444) and a dated 2026-11-01 lab verification; it is not proof that Manager 9447 is currently configured. Local operational manifests are expressly outside Git and must not be inferred from source.
4. Public interface: command-line JSON-in/check result and exit status; private boundary: no Serve configuration mutation, no API route, no credential inspection, no HTTP endpoint. No domain events, SQL schema, or migrations are owned by this checker. No deployment claim.

## Findings / limits

- The checker validates shape and expected target, not actual reachability, TLS certificate, effective ACL, identity, process ownership, or service health.
- Potential contract gap: `AllowFunnel` is rejected only when its hostname entry is literal boolean `true`; other truthy/malformed values are not rejected. Actual Tailscale schema compatibility needs explicit fixture tests, not assumptions.
- The `free` check looks for the port in TCP or matching Web hostnames; other malformed config fields are not exhaustively validated.
- No complete inventory of I07 test files, callers, current deployed Serve configuration, or CI evidence established in this checkpoint. No tests run; no DevServer access.
- Code presence, test success and deployed/homologated status remain separate. Catalog's `partial` is retained. No meaningful global-divergence-zero claim, review gate, or public GitHub Pages SHA verified.

## Follow-up gates

Inspect call sites and tests for `check-tailnet-route.py`; add isolated fixture coverage for valid/invalid mappings and `AllowFunnel` variants in a separate authorized code change; reconcile I07/I02 thematic docs after review. Confirm latest main/branch before any future mutation; merge only reviewed documentation with no unrelated changes.
