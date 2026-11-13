## 0. Fontes verificáveis e limites da auditoria

Q10 tem ownership de código em `tests/integrity` e supervisão documental sobre **critérios de qualidade**. Não é executor de todos os testes nem componente de negócio. Baseline de auditoria: `origin/main` SHA `69670e27e5c8e22240642f5cde67986ac0e8376b`, 12/11/2026.

| Evidência | Fonte | Interpretação correta |
|---|---|---|
| Identidade da unidade | `catalog/work-units.json`, `docs/subprojects/index.json` | Owner da Q10 é `tests/integrity` |
| Instruções de integridade | `tests/integrity/AGENTS.md` + [AGENTS global](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md) | Gate rápido em push/PR; não substitui lint/unit/integração |
| Implementação do gate | `tests/integrity/repository-structure.sh` e `scripts/architecture/check-work-units.mjs` | Validação estática da organização e dos contratos de agentes |
| Testes principais e paridade | [Syndes Mainline CI](https://github.com/delmacy/syndes-system/blob/main/.github/workflows/syndes-ci.yml), `scripts/ci/plan.mjs`, `scripts/ci/parity.test.mjs`, `scripts/ci/run-suite.sh` | Definição de pipeline, não resultado comprovado |
| Política e cenários | [TEST-STRATEGY](../../../engineering/TEST-STRATEGY.md), `tests/security/AGENTS.md`, `tests/integration/AGENTS.md`, `tests/performance/AGENTS.md` | Camadas de testes; algumas requerem ambiente externo e ensaios reais |
| Requisitos de release | [INTEGRATED-RELEASE-CANDIDATE](../../../engineering/INTEGRATED-RELEASE-CANDIDATE-20261109.md), [Support release gate](../../../engineering/SYNDES-SUPPORT-RELEASE-GATE.md) | Condições e bloqueios históricos devem ser revalidados |
| WBS e critérios de aceite | [Q10 EVOLUÇÃO](../EVOLUCAO.md), [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Tarefas 00.08, 70.09, 95.01, 95.06 e 95.07 |
| Prova da falha corrente | [CI do SHA auditado](https://github.com/delmacy/syndes-system/actions/runs/43335397128) | Falha na prova de paridade; **gate global não aprovado** |

**Regra:** observar sempre o SHA, o nome da suíte, resultado, ambiente, artefato de build, riscos e aceite. Um teste em PostgreSQL sintético ou um Pages publicado não é staging/produção homologado.
