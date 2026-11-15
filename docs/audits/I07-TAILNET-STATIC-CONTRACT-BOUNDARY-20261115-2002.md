# I07 Tailnet — static contract audit (2026-11-15 20:02 BRT)

## Immutable source baseline
- Main inspected: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (GitHub commit search); catalog `catalog/work-units.json` blob `d2aa27a13e30df16a28812f965577914430728b3`.
- Owner I07 is `partial`, source `infra/master-admin/check-tailnet-route.py` blob `d51f6e69f2b0a04670eaf7c7119950fa53da1452`. It is distinct from I06 Traefik HTTPS and the Workspace Tailnet route documented in `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` blob `c440d1c157c3b63fb552b255c22e3b80ae0d8983`.
- No operational or deployment assertion follows from catalog maturity.

## Public versus private boundary
- CLI contract: JSON Tailscale Serve config via stdin, `--mode free|active`, port 9447 default, target restricted to `http://127.0.0.1:18085`; exit 0 on PASS, 2 on BLOCKED. No secret or hostname is printed.
- Internal `check(config, mode, port, target)` validates top-level dict, TCP/Web mappings, exactly one Web hostname ending in `:port`, HTTPS flag, only root Proxy handler to approved local target, and no `AllowFunnel[hostname] == true`.
- `free` checks only absence of the dedicated port in TCP and matching Web entries. `active` validates the declared route, not live HTTP reachability, DNS, TLS certificate, application identity, tenant authorization, or the actual Tailscale daemon state.
- `active` does not reject additional keys inside `TCP[port]`, nor verify that `AllowFunnel` is globally disabled; the check is scoped to the matched hostname. These are validation-boundary observations, **not** evidence of exploitable exposure.
- No application HTTP APIs, domain events, database schema or migrations are defined by this Python checker. Manager frontend/backend ownership is elsewhere. Workspace runbook documents different 9443/9444 routes and historical lab observations, not proof of 9447 readiness.

## Evidence and open questions
- Inspected Python checker and Workspace runbook via GitHub MCP at the immutable baseline. GitHub code search for `check-tailnet-route`, `9447`, `AllowFunnel` returned no indexed matches; this **does not prove absence** of tests or consumers.
- No isolated tests were run. No CI checks, runtime, DevServer, Docker, Tailscale, SQL, migrations, deployment, or GitHub Pages publication were executed/verified.
- Follow-up: inspect caller/test inventory and ensure CLI output is documented as *static Serve-config validation*, never as end-to-end private-route, certificate or authenticated Manager readiness. Correlate test/CI evidence with the exact source SHA before upgrading maturity.
- Global reconciliation of 57 catalog units plus discovered owners, independent review gates and public Pages SHA remain open; do not claim zero divergences.

## Change scope
Documentation-only audit checkpoint on a dedicated branch; no product source or other writer branch changes.
