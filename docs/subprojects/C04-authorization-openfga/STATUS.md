# C04 — Authorization OpenFGA | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código: `2e1707c`; revisão de arquivos e inspeção de containers **somente leitura** no DevServer01. **Não foram consultadas tuples reais, stores, usuários nem tokens.** Nenhuma configuração, grant, migration, serviço ou banco foi alterado. Homologação, staging e produção **não verificados**.

## Estados separados por evidência

| Dimensão | Evidência | Limite |
|---|---|---|
| Documentação | Modelo OpenFGA, ports e consumidores mapeados com owner e testes | Auditoria parcial; revisão formal pendente |
| Código | Modelo JSON `schema_version=1.1`, adapters FGA de usuário e serviço, verificações fail-closed | Não implica tuples, stores ou permissões implantadas |
| Integração sintética | Testes de adapters, escopo e suíte in-memory OpenFGA versionada | Não equivale a acesso real do tenant/operador |
| Operação DevServer01 | Container `syndes-security-access-openfga-1` observado **Up** em 13/11 | Não foi consultado model ID vigente, health autenticado ou decision log |
| Produto e segurança | **NÃO HOMOLOGADO** | Negativas reais multi-tenant e grants operacionais pendentes |

## Contratos observados e ownership

- **C04:** `infra/security-access/fga-model.json` declara tipos `user`, `service`, `tenant`, `resource`, `event_delivery`; `can_read`, `can_write` e `can_process` são relações distintas.
- **A04 Core Host:** `FgaPermission.canAccess` faz `POST /stores/{store}/check`, exige decisão booleana; `TenantEventWorkerAdmission.authorize` combina ENABLED, escopo tenant/org/workspace e grant de serviço.
- **A06 Account API:** `createFgaWriteAuthorizer` usa identidade de usuário e recurso hash do tenant; não confundir com permissão de operador global.
- **C06 Event Platform (adapter no A04):** `OpenFgaServiceEventGrant.canProcess` exige `service:`, `event_delivery:` e `can_process`; não usa token ou tuple de usuário.
- **C01/Organizations:** tenant membership, estado da organização e módulos ENABLED são gates distintos de decisão FGA.

## Divergências e bloqueadores

1. **P0 — estado efetivo desconhecido:** `fga-model.json` é contrato versionado; model ID/tuples/store reais do OpenFGA DevServer01 não foram consultados. Não afirmar migração de `event_delivery`.
2. **P0 — isolamento de tenant não homologado:** testar matrizes de user/service, tenant A/B, org/workspace e negações em ambiente autorizado; testes descartáveis não provam produção.
3. **P1 — aplicação dos grants service:** WBS/ADR descrevem candidato tipado, mas o worker continua com gates; não ativar dispatcher, escrever tuples ou aplicar modelo por inferência.
4. **P1 — inventário de consumidores:** verificar todas as rotas/controllers/jobs/SSE realmente protegidos; `FgaPermission` não prova cobertura universal.
5. **P1 — disponibilidade e recuperação:** registrar health, métricas, versionamento do modelo, rollback, backup, rotação do token e tratamento de indisponibilidade.

## WBS C04 — próximos checkpoints

| ID | Estado | Entrega necessária |
|---|---|---|
| C04.DOC.01 | **AUDITORIA PARCIAL** | Contratos e fontes reconciliados, evidências source-linked |
| C04.SEC.01 | PENDENTE | Snapshot autenticado *read-only* de modelo, stores e política efetiva, sem tuples/PII em docs |
| C04.SEC.02 | PENDENTE | Testes adversariais A/B, user/service, grants, revogações e fail-closed no ambiente-alvo |
| C04.OPS.01 | PENDENTE | Health, modelo versionado, autorização de migrations/tuples, backup/restore e rollback |
| C04.GATE | BLOQUEADO | Aceite integrado com C01/C03/A04/A06/C06 e owners |

**Próxima auditoria documental:** C05 — Secrets OpenBao. A existência de um arquivo/modelo nunca confirma permissões efetivas.

[Referência](REFERENCIA-TECNICA.md) · [Operação](OPERACAO.md) · [Capítulos](ESCOPO.md).
