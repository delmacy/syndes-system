# I12 — Manager container hardening: static follow-up (2026-11-16 00:03 -03)

## Baseline and ownership
GitHub MCP `main@1cf48cc0a1281017ac58f7b9b9747f663109e151` compared identical to the prior main baseline before this checkpoint. `catalog/work-units.json` assigns I12 to `infra`, maturity `partial`, documentation parent I02; catalog maturity is not acceptance. Prior I12 checkpoint `audit/i12-host-boundary-compose-20261114-1256` remains separate and unchanged.

## Source contracts inspected
- `infra/master-admin/compose.yaml`: API on internal `master-private` plus external data/identity networks; web publishes `127.0.0.1:${MASTER_BIND_PORT:-18085}:8080`. Both declare `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, tmpfs and healthchecks.
- Neither Manager service declares a Compose `user:` nor `mem_limit` / CPU resource bounds in this file. Image Dockerfile users and runtime effective identities were **not inspected**; absence in Compose does not prove root execution or unbounded effective resources.
- Manager API and web use locally built `:local` images; Compose does not pin image digests. `infra/master-admin/homolog-deploy.sh` validates frontend source-tree equivalence against artifact commit and locally builds API, but does not attest matching API/web immutable image digests.
- `infra/security-access/compose.yaml` enables Keycloak health and metrics, configures HTTP behind trusted HTTPS proxy, and does not publish host ports. OpenFGA and OpenBao similarly lack host port mappings. No host firewall, effective proxy trust or metrics access was verified.
- `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md` documents unversioned host-side Traefik/Workspace manifests and a historical 2026-11-01 observation, not a current acceptance result.

## New evidence gaps
1. **I12-MANAGER-01 — Effective identity/resource envelope unverified.** Compose hardening flags are present, but effective UID/GID and resource limits cannot be established from the inspected declarations alone. Review Dockerfiles, running container configuration and cgroup limits before calling host hardening accepted.
2. **I12-MANAGER-02 — Artifact identity boundary.** Manager Compose references locally built mutable image tags, not digests. An approved commit and healthy containers do not alone establish the exact deployed binaries; coordinate with I11 provenance gate rather than duplicating ownership.
3. **I12-PROXY-03 — Trust boundary unverified.** Keycloak accepts forwarded proxy headers and relies on separately provisioned ingress. The current trusted proxy topology, ingress allowlists, TLS and external reachability were not inspected; absence of `ports` is only a Compose declaration.

## Classes, APIs, events, schemas, tests
I12 owns host configuration, not Manager domain classes, API contracts, domain events or database migrations. Manager `/readyz` is referenced by the Compose healthcheck, but authentication, authorization and tenant isolation are outside this checkpoint. No test was run; no current CI success, deployment, homologation, host observation or GitHub Pages public SHA was established.

## Safety and next gates
Static GitHub-only inspection. No DevServer access, tests, SQL, migrations, Docker commands, secrets, credentials, runtime changes, workflows, deployments, merges or changes to other branches. These are evidence gaps, **not proven vulnerabilities**. Continue with Q01 after resolving I12 ownership boundaries. Full reconciliation of 57 catalog units plus discovered owners, zero divergences, review gates and public Pages SHA remain open.
