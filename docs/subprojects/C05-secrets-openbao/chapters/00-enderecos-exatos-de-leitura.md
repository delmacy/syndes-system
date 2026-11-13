## 0. Endereços exatos de leitura

- Catálogo C05: `catalog/work-units.json`; índice: `docs/subprojects/index.json`.
- Compose: `infra/security-access/compose.yaml`; configuração: `infra/security-access/openbao/config.hcl`.
- Contratos: `infra/security-access/openbao/render_runtime.py`, `run-renderer.sh` e `policies/*.hcl`.
- Core Host A04: `apps/core-host/src/secrets.ts`, `test/secrets.test.mjs`.
- Manager: `infra/master-admin/openbao/render-master.py`, `operator-provision.py`, `run-renderer.sh`.
- Smoke descartável: `tests/platform/openbao-smoke.sh`.
- Runbook: `infra/security-access/openbao/README.md`.
- Auditoria: `docs/subprojects/C05-secrets-openbao/{STATUS,REFERENCIA-TECNICA,OPERACAO}.md`.
