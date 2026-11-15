# Q08 — Release Engineering: source and boundary audit (2026-11-14)

- **Repository:** `delmacy/syndes-system`
- **Inspected main SHA:** `1cf48cc0a1281017ac58f7b9b9747f663109e151` (GitHub compare against main: identical at inspection)
- **Scope:** next Q-series owner after Q07; provisional Q08 release-engineering boundary, not a claim of complete catalog reconciliation.
- **Method:** GitHub MCP source reads only; no DevServer, runtime, SQL, migrations, deployment, workflow edits or test execution.

## Actual source and interfaces inspected

| Source | Verified implementation or contract | Boundary |
| --- | --- | --- |
| `.github/workflows/syndes-ci.yml` | PR impact planning, full suites on main, foundation, regression, reusable parity workflows and aggregate CI gate | CI workflow, not production deployment |
| `scripts/ci/plan.mjs` | 15 catalog suite definitions and impact/full matrix | Test-selection CLI; no HTTP API or domain event |
| `scripts/ci/run-suite.sh` | Build/test executor, disposable PostgreSQL for selected suites, container builds | CI execution; no release promotion |
| `.github/workflows/platform-manager.yml` | API/web tests, disposable PostgreSQL/Keycloak, runtime-only web image build, artifact upload with seven-day retention | CI artifact production; not proof of deployed digest |
| `infra/master-admin/homolog-deploy.sh` | `--preflight|--apply`, path/identity/secret/health gates, frontend manifest `git_commit` check, runtime image build, private Tailnet route | Host-specific operator script, not a versioned public release API |
| `infra/master-admin/compose.yaml` | Isolated Manager API/web, loopback frontend binding, external private networks | Declarative topology, not observed host state |
| `apps/master-admin-api/Dockerfile` | Installs production dependencies and copies API source at image build | No immutable CI image digest asserted by deploy script |
| `apps/master-admin-web/Dockerfile.runtime` | Consumes externally supplied static web bundle; unprivileged nginx | Runtime frontend only |

## Material divergences / release blockers

1. **Q08-01 — API provenance gap (confirmed in source):** `homolog-deploy.sh` checks a frontend `CI_ARTIFACT_MANIFEST.json` against source history but executes `docker build --pull=false` for the API on the target checkout and tags `syndes/master-admin-api:local`. The inspected script does not verify a CI-produced immutable API digest or attest the API artifact before application. A successful CI run is not equivalent to proof that the deployed API image is that exact artifact.
2. **Q08-02 — rollback semantics gap (confirmed in source):** the error trap can disable its owned Tailnet route and `docker compose down` the isolated Manager stack; it does not restore a previously deployed API/web image, persisted previous release configuration or verified rollback health. Labeling this a version rollback would be inaccurate.
3. **Q08-03 — PR deletion blind spot (cross-owner Q07, confirmed):** `syndes-ci.yml` uses `git diff --name-only --diff-filter=ACMRT`, excluding deleted paths. The planner cannot select suites based on deleted files it never receives. This is an inherited release gate risk, not an independently verified production incident.
4. **Q08-04 — frontend artifact linkage not end-to-end proven:** CI uploads `apps/master-admin-web/dist/` with seven-day retention, while the host script requires `artifacts/web-dist/CI_ARTIFACT_MANIFEST.json`. The inspected workflow does not itself demonstrate how the manifest is produced, transferred, verified or bound to the downloaded artifact. Further source and evidence tracing required; do not infer absence globally.

## Public/private contracts, classes, APIs, events, data

- Public release interface identified: GitHub Actions gate statuses and CI artifact; no independent public Q08 HTTP endpoint established.
- Private interfaces identified: CLI flags, runtime environment/secret-file paths, Docker image tags, Compose healthchecks, Tailnet port and manifest `git_commit`.
- Source classes: Q08 inspected material is Bash, YAML, Dockerfile and JS functions, not an independently owned domain class hierarchy.
- APIs/events: Manager API and Keycloak are dependencies of deployment; no Q08-owned domain event, route or event publisher demonstrated.
- Schemas/migrations: Control DB role and owner checks are operational prerequisites. No Q08-owned SQL migration identified in inspected sources; no schema was applied.
- Tests: static workflow declarations for API, frontend, identity, PostgreSQL and network checks exist. **No tests were run in this audit.** No successful check suite was correlated to this main SHA, and no real release/rollback exercise was observed.
- Deployment/homologation: **not confirmed**. Public GitHub Pages publication SHA and global review gates: **not confirmed**.

## Evidence and remaining review

Evidence is limited to GitHub MCP reads of the eight paths above at the recorded main state. Review Q08-01 through Q08-04 against the authoritative release specification and other release scripts before assigning final owner status. Verify artifact manifest generation and digest binding, previous-version recovery, deletion-sensitive CI selection, CI checks on the exact SHA, and published Pages SHA. Reconcile Q08 with the full 57-unit catalog and newly discovered owners; **meaningful divergences are not zero**. This checkpoint is an isolated audit document, not an approval or merge request.
