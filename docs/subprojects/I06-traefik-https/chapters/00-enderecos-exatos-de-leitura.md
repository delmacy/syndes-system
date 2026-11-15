## 0. Endereços exatos de leitura

- Catálogo: `catalog/work-units.json` e `docs/subprojects/index.json` (I06 ligado a I02).
- Declarações de roteamento versionadas: `modules/whatsapp/deploy/devserver01-cutover.compose.yaml`.
- Contexto de cutover e rollback: `modules/whatsapp/deploy/README.md`.
- Runbook histórico: `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md`.
- Evidência auditável: [checkpoint I06](../../../evidence/checkpoints/I06-traefik-https-github-reconciliation-20261113.md).
- Políticas de contribuição: `AGENTS.md`; status e gates em [STATUS](../STATUS.md) e [Operação](../OPERACAO.md).

- Evidência adicional não integrada: `docs/audits/I06-RUNBOOK-TEST-SAFETY-20261115-0801.md` em `audit/i06-runbook-test-safety-20261115-0801` e `docs/audits/I06-LIVE-READINESS-EVIDENCE-BOUNDARY-20261115-1903.md` em `audit/i06-live-readiness-evidence-20261115-1903`.
- Scripts de prova: `apps/workspace-web/tests/live-readiness.mjs`, `anonymous-smoke.mjs`, `browser-smoke.mjs`; verificar versões por SHA antes de reutilizar conclusões.
