# Q01 — Plataforma de testes | STATUS

> **AUDITORIA TÉCNICA PARCIAL — FONTES ESTÁTICAS — 12/11/2026.** Fontes em `tests/`, `AGENTS.md`, Test Strategy, Q07 e Q10, com checkout `origin/main` SHA `bd0aa69349879485156ce05ffcb211904d34c206` em worktree isolada. **Não foram executadas suites destrutivas de infraestrutura diretamente no DevServer**. O CI central da mesma revisão passou [24/24 jobs](https://github.com/delmacy/syndes-system/actions/runs/43340637846) no GitHub Actions.

## Estado por dimensão

| Dimensão | Evidência comprovada | Limites e gates |
|---|---|---|
| **Documentação Q01** | **Auditoria parcial**: capítulos 00–07, referencia técnica e matriz de suites/owners preenchidos | Aprovação técnica da taxonomia e lacunas pendente |
| **Implementação** | Scripts reais em `tests/platform` e `tests/integrity`, AGENTS em integration/security/performance; testes também em modules/apps | Sem backend/API/schema/frontend exclusivo de Q01; nem todo AGENTS tem runner |
| **Estrutura/validação local** | Leitura/checagem de fontes, sintaxe e integridade não destrutiva realizadas nesta revisão (ver checkpoint) | Não cria fixture de identidade ou dados de cliente |
| **Integração CI central** | [Run 43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846) no SHA `bd0aa69349879485156ce05ffcb211904d34c206`: **24/24 jobs success**, incluindo infra, Manager, Support e Serviço | Ambiente GitHub Actions descartável, não release de produção |
| **Testes de performance** | Diretrizes `tests/performance/AGENTS.md` e Test Strategy | Stress/spike/soak e resultados p50/p95/p99 **não verificados** |
| **Backup/restore e RC** | Restore de fixture e scripts de preflight presentes no CI | Restore de ambiente operacional, rollback e RPO/RTO **não verificados** |
| **Produto/Go-live** | Não há Product Gate atribuído à Q01 | MVP não homologado por esta auditoria; aceite pertence aos owners |

## Fontes e critérios de prova

| Grupo | Script/fonte identificado | Evidência exigida além de presença |
|---|---|---|
| Estrutura e catálogo | `tests/integrity/repository-structure.sh` | Exit 0 no SHA; não cobre regras de negócio |
| DB/roles | `postgres-smoke.sh`, `account-roles-pg-smoke.sh`, `platform-manager-postgres-smoke.sh` | Exigir fixture, flags, negativas de acesso, cleanup e run |
| Keycloak/OpenFGA/OpenBao | `platform-manager-keycloak-ci.mjs`, `openfga-smoke.sh`, `openbao-smoke.sh` | Ambientes descartáveis e permissão/denegação testadas |
| Browser e Host | `core-host-runtime-smoke.sh`, paridades Q07 | Jornadas com identidade/tenancy reais de **CI**, não credenciais operacionais |
| Diretrizes de integração/segurança | `tests/integration/AGENTS.md`, `tests/security/AGENTS.md` | Testes localizados nos módulos/plataforma; não declarados prontos só pelo AGENTS |
| Performance | `tests/performance/AGENTS.md` | Sem benchmark aprovado nesta revisão |

## Bloqueios e riscos

1. **Ausência de runner nas subpastas de estratégia:** `tests/integration`, `tests/security`, `tests/performance` só contêm AGENTS; a cobertura real é distribuída e precisa ser mapeada por comportamento e owner.
2. **Provas descartáveis versus operação real:** PostgreSQL, OpenFGA, Keycloak, OpenBao e restore testados em CI não constituem restore/rollout operacional.
3. **Scripts com efeitos colaterais:** `ci-secret-fixtures.py` escreve em `/run/syndes/runtime`, e `run-infra.sh` cria/derruba containers e redes. Não executar no DevServer compartilhado sem isolamento específico.
4. **Performance/RC:** resultados medidos, RPO/RTO, restore, rollback e aceites de produto permanecem não comprovados.
5. **Q10 histórico:** seu registro de falha de CI reflete SHA anterior; o [run atualizado](https://github.com/delmacy/syndes-system/actions/runs/43340637846) comprova recuperação do pipeline, mas não aprovação dos Product Gates.

## WBS e continuidade

A [EVOLUÇÃO Q01](EVOLUCAO.md) associa **00.08 (BLOQ), 95.01 (PEND) e 95.02 (PEND em outra frente)** na WBS histórica. O sucesso do Q07 não altera automaticamente essas tarefas.

**Entrega desta atualização:** referência do conjunto de testes, responsabilidades, matriz de requisitos/negativas, diagrama de execução, riscos e STATUS, sem alterar código de testes de produto, CI, scripts operacionais ou ambientes.

**Próxima unidade do plano documental:** **P14 — Platform Core**, com validação do inventário lógico de core antes de atribuir APIs, classes ou persistência.

| Data | SHA/ambiente | Método | Pendente |
|---|---|---|---|
| 2026-11-12 | `bd0aa69349879485156ce05ffcb211904d34c206`, DevServer01/worktree isolada | Leitura de fontes/AGENTS/estratégia e consulta do [CI verde](https://github.com/delmacy/syndes-system/actions/runs/43340637846) | Homologação QA, performance, restore real, Product Gate |

**Status da Q01: auditoria parcial.** CI aprovado por SHA não significa liberação do SaaS.
