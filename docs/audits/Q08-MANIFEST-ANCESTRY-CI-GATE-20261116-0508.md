# Q08 — Manifest ancestry and CI approval boundary (2026-11-16)

- Repository: `delmacy/syndes-system`; inspected GitHub main `1cf48cc0a1281017ac58f7b9b9747f663109e151` (compared identical with main at start).
- Incremental Q08 follow-up; does not replace `Q08-RELEASE-ENGINEERING-SOURCE-BOUNDARY-20261114-2104.md`.
- Sources read directly through GitHub MCP: `infra/master-admin/homolog-deploy.sh`, `.github/workflows/platform-manager.yml`, `scripts/ci/plan.mjs`, previous Q08 checkpoint. No DevServer access.

## New precise boundary

**Q08-MANIFEST-05 — Git commit existence and selected path equivalence are not CI approval or ancestry.** The deployment preflight reads `artifacts/web-dist/CI_ARTIFACT_MANIFEST.json.git_commit`, checks a 40-hex SHA and `git cat-file -e "$source_sha^{commit}"`, then compares selected frontend paths with `git diff --quiet "$source_sha" "$head" -- ...`. It does **not** require `git merge-base --is-ancestor "$source_sha" "$head"`, check an approved CI run/check-suite for that SHA, or hash the actual `web-dist` payload. A commit that merely exists in the local object database and has identical selected paths can pass these checks. This is a provenance-validation gap, not proof that an unauthorized artifact has been deployed.

**Q08-MANIFEST-06 — CI workflow does not bind the uploaded web bundle to the deploy manifest.** `.github/workflows/platform-manager.yml` builds `apps/master-admin-web/dist/` and uploads it as `platform-manager-web-dist` (seven-day retention). In the inspected workflow there is no step producing `CI_ARTIFACT_MANIFEST.json`, checking its `git_commit`, or publishing a bundle digest. The deployment script expects that manifest under `artifacts/web-dist/`. The producer/transfer/verification chain is not established by these two files. This refines Q08-04; absence elsewhere is **not** asserted.

## Contract reconciliation

- Public interface: CI workflow/artifact and its declared jobs; no Q08-owned HTTP API demonstrated.
- Private interface: deploy CLI `--preflight|--apply`, local manifest, selected Git path comparison, image build and private Tailnet route.
- Classes/events: Bash/YAML workflow functions; no independently owned Q08 domain class, event producer or consumer in inspected material.
- Schema/migrations: database checks are preflight prerequisites; no Q08-owned migration established, none applied.
- Tests: CI declares unit, browser fixture, PostgreSQL, network and JWT jobs; their existence is **not** a successful run on the inspected SHA. No isolated test executed here.
- Source exists: **yes** for the two scripts/workflow; test success: **unverified**; deployment and homologation: **unverified**.

## Review gates and boundaries

Recommend exact-SHA CI attestation plus immutable bundle checksum/digest, explicit ancestor/approved-commit policy, and a documented manifest producer/consumer chain. Coordinate with I11 provenance findings and Q07 deletion-only CI gap without duplicate ownership. No runtime, build, SQL, migrations, Docker, secrets, workflows, other branches, merge or deployment modified. This audit adds documentation only; it is not an approval. The 57 catalog units plus discovered owners, global meaningful divergences, review gates and published GitHub Pages SHA remain unreconciled/unconfirmed.
