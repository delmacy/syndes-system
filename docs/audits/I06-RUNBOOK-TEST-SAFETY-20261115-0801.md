# I06 — Ingress runbook and test-safety boundary (2026-11-15 08:01 BRT)

## GitHub-first baseline
Canonical main `1cf48cc0a1281017ac58f7b9b9747f663109e151` was verified identical to main by GitHub compare before creating this dedicated branch. Existing I06 branches `audit/i06-infra-boundary-20261114-0756` and `audit/i06-ingress-source-20261114-0900` were consulted, not modified. This checkpoint is a follow-up, not a new runtime acceptance.

## New finding I06-TEST-01: read-only classification in runbook is overbroad
`docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` groups `npm run build` under **“Testes seguros — sem alterar dados”**, while its own update procedure explicitly warns that `dist` is mounted directly into the live static container and a build can expose non-atomic changes. Thus `npm run build` is **not safely read-only with respect to deployed artifacts**, even if it does not change database rows. Do not execute it on DevServer01 as an audit-only test. `npm test`, `npm run lint`, and browser scripts also require isolated-environment review before execution; no tests were executed.

## Source / contract cross-check
- Versioned `modules/whatsapp/deploy/devserver01-cutover.compose.yaml` declares HTTP Traefik routers on `web`, priorities 110/2, middleware reference `syndes-tailnet-only@docker`, and destinations 8082/80; it does not declare `websecure`, `tls=true`, certificate resolver or middleware definition.
- The 2026-11-01 runbook reports HTTPS on port 9443 and anonymous CRM 401 in a historical lab observation, but relies on **unversioned** `/srv/syndes-lab/workspace.traefik.yaml`. This does not prove that the versioned WhatsApp shadow routers have TLS or are currently deployed.
- Public/private trust boundary: Traefik path routing and middleware are distinct from Core Host JWT, tenant membership, OpenFGA and PostgreSQL isolation. Static Workspace HTTP 200 cannot establish backend authorization.
- I06 owns declarative ingress; no I06-owned class exports, business HTTP API, domain event, schema or migration were established by these inspected sources. Core Host and Workspace are separate owners; absence is not asserted repository-wide.
- No I06-specific SHA-linked CI result, TLS certificate chain, effective Docker middleware, negative network test, production deployment, rollback drill or homologation was inspected.

## Risk and next gates
I06-TEST-01 is a **documentation/test-execution safety divergence**; correct the runbook through its documentation owner, without editing other writers' work here. Separately, retain I06 TLS and allowlist enforcement as unverified. Verify configuration provenance and runtime only with explicit authorized read-only inspection; do not run builds, deployments, probes with side effects or scripts that mutate data.

No DevServer access, tests, builds, SQL, migrations, secrets, CI/workflow changes, code changes, deployments or merges. This checkpoint does not advance maturity from source-present to tested/deployed. The 57 catalog units and any discovered owners still require global reconciliation; zero meaningful divergences, review gates and public GitHub Pages SHA are not established.
