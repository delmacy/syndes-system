---
title: "Q01 · Requisitos e casos de uso"
description: "Volume Infraestrutura e qualidade · capítulo Q01 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias, casos de uso e negativas

Os IDs seguintes identificam **rastreio documental de requisitos já descritos nos AGENTS e na Test Strategy**. Não criam features, gates novos nem metas numéricas adicionais.

| Critério | Fonte | Evidência de aceite |
|---|---|---|
| Q01-R01 — Teste reproduzível | `tests/AGENTS.md` | SHA, suite, comando, ambiente, fixtures, resultado/skip/failure |
| Q01-R02 — Tenant A/B isolados | `tests/security/AGENTS.md`, `postgres-smoke.sh`, suites de módulo | Tentativas de leitura/escrita cruzadas recusadas no backend e DB |
| Q01-R03 — Autorizações negativas | `tests/security/AGENTS.md`, `openfga-smoke.sh`, suites Manager | Tokens inválidos, wrong audience, membros revogados e service down negados |
| Q01-R04 — Persistência e rollback | `tests/integration/AGENTS.md`, PostgreSQL de ensaio | Migrations idempotentes, falha com rollback, restauração sem corrupção |
| Q01-R05 — Erros de providers | `tests/integration/AGENTS.md` | Timeout, erro, repetição/duplicação além de happy path |
| Q01-R06 — Segurança de secrets | `tests/platform/ci-secret-fixtures.py`, OpenBao e rede | Env e arquivos sintéticos, ausência de exposição e TLS conforme cenário |
| Q01-R07 — Integração real de UI | Test Strategy; suites Support/Manager/Workspace | Autenticação real e isolamento por público em browser de CI |
| Q01-R08 — Performance e recovery | `tests/performance/AGENTS.md` | Medição em hardware controlado; não aprovar por plano de capacidade |
| Q01-R09 — Gates separados | `AGENTS.md`, Test Strategy, Q07/Q10 | Diferenciar local, CI, RC, rollout, operação e Product Gate |

### Histórias de consulta

**US-Q01-01 — QA:** como responsável por qualidade, preciso saber qual suite executa a negativa de acesso de um tenant a outro e em qual ambiente foi comprovada para impedir aceite baseado somente em mock.

**US-Q01-02 — Dev:** como owner de módulo, preciso escolher teste unitário, integração e browser adequados, sem rodar containers operacionais nem remover cenários adversos quando o teste falha.

**US-Q01-03 — Operações:** como responsável por release, preciso separar ensaio descartável de backup/restore do restore efetivo do ambiente alvo, com cadeia de SHA/artefato e aprovação.

**US-Q01-04 — Gestor:** como gestor de projeto, preciso distinguir cobertura implementada de critérios planejados, vinculando WBS, CI, Product Gate e histórico sem progresso fictício.

### Casos de uso principais

**UC-Q01-A — Alteração com fronteira tenant:** modificar no owner → teste unitário → SQL de banco descartável A/B → negação FGA/backend → CI por impacto → considerar gate de produto separadamente.

**UC-Q01-B — CI de infraestrutura:** criar fixtures sintéticas → PostgreSQL, Keycloak/OpenFGA/OpenBao e redes isoladas → testar acessos permitidos/negados, segredo e restore de fixture → limpar containers/volumes → associar run e SHA.

**UC-Q01-C — Release candidate:** recuperar histórico de testes → executar stress/spike/soak em ambiente separado → ensaio real de restore/rollback apropriado → revisar métricas e riscos → obter aprovação explícita. **A documentação não executa nem aprova essa sequência.**

### Matriz de testes negativos

| Fronteira | Falha que deve ser demonstrada |
|---|---|
| Tenant A → B | Leitura, alteração e listagem cross-tenant rejeitadas |
| Usuário sem grant → API | Falha fechada antes de side effects |
| Identidade de Manager → Workspace | Não herdar escopo nem acessar dados privados |
| Secrets / rede | Credenciais não expostas em env/log; serviço isolado |
| Webhook/consumer | Replay/duplicação/idempotência; sem perda silenciosa |
| Migração | Falha e rollback sem estado parcial |


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/02-requisitos-historias-e-casos-de-uso.md).
