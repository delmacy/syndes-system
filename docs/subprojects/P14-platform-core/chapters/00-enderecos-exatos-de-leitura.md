## 0. Fontes verificáveis e endereço da unidade

> **Auditoria documental parcial — 12/11/2026.** Baseline: commit `e2c5194a97d48d8a809231d7088be668604725fb` de `origin/main`, worktree isolada no DevServer01.

| Questão | Fonte exata | Interpretação |
|---|---|---|
| Quem é P14? | `catalog/work-units.json` — `P14`, `path=modules/platform-core`, `maturity=contract` | Fronteira de contrato, não pacote publicado |
| Regras | [`modules/platform-core/AGENTS.md`](https://github.com/delmacy/syndes-system/blob/main/modules/platform-core/AGENTS.md) e `AGENTS.md` global | Missão transversal, limites e invariantes; P14 não implementa sozinho cada capacidade |
| Kernel | [`packages/core-kernel/package.json`](https://github.com/delmacy/syndes-system/blob/main/packages/core-kernel/package.json), `src/index.ts`, `kernel.ts`, `contracts.ts`, `module-registry.ts` | Package privado `@syndes/core-kernel` (A08), com exports públicos tipados |
| Host | [`apps/core-host/src/main.ts`](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/src/main.ts), `module-host.ts`, `config/modules.json` | Runtime NestJS/composition root (A04), plugins trusted fixos |
| Control / Identity / Authorization | `modules/organizations`, `apps/account-access-api`, `apps/master-admin-api`, `infra/`, `apps/core-host/src/adapters.ts` | Sistemas e adaptações com owners próprios, não conteúdo do `modules/platform-core` |
| Events | `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts`; `apps/core-host/src/platform-event-*.ts` | Contratos e código opt-in; não há worker/scheduler operacional liberado |
| Decisão de composição | [ADR-COMPOSICAO-MODULAR-CORE](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) | Arquitetura aprovada, perfis CMP-02–09 ainda por implementar/homologar |
| Plano especializado | [WBS-COMPOSICAO-MODULAR-CORE](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-COMPOSICAO-MODULAR-CORE-20261111.md) | CMP-01–10: PEND/BLOQ/CONDICIONAL, não entregas prontas |
| Evidência de CI | [Mainline 43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065) | 24/24 jobs `success` no SHA auditado, sem equivaler a deploy ou Product Gate |
| WBS vinculada | [EVOLUÇÃO P14](../EVOLUCAO.md) | 00.01, 50.01, 50.08, 55.03, 70.09, 95.01, mais frente CMP |

A consulta deve fixar SHA/owner/arquivo. O portal Docs é **público**: não registrar senhas, tokens, topologia administrativa interna nem configurações de produção.
