# P01 — CRM | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

## Checkpoint documental — 14/11/2026

[**Ficha Mestre P01**](FICHA-MODULO.md), [matriz](MATRIZ-ACOES.md) e 18 fichas por ação documentam histórias descritivas, edge cases, APIs, permissões e cenários de teste **propostos**, com fontes versionadas. Não houve alteração runtime, novo teste do CRM, migration, grant, ativação de worker, deploy ou Product Gate. Permanecem válidos os 29 PASS **históricos de 12/11** da auditoria abaixo.

## Situação revalidada

Código de CRM com plugin NestJS, pessoa/organização, notas, tags, canais, CSV, SQL 001–003 e UI Workspace. Não comprovada nesta auditoria uma jornada autenticada real de CRM ou ativação multi-org.

| Fonte | O que foi confirmado |
|---|---|
| `modules/core-crm/package.json` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/core-crm/src/plugin.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/core-crm/src/crm.controller.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/core-crm/src/context-guard.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/core-crm/src/whatsapp-identity-events.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/core-crm/sql` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/workspace-web/src/features/crm.tsx` | Artefato presente no checkout; não implica runtime habilitado |

**Testes executados nesta revisão:** cd modules/core-crm && npm test — 29 PASS, 0 FAIL.

## Bloqueios e limitações

- Keycloak/OpenFGA com memberships tenant/organização/workspace e negações 401/403 em HTTP e browser reais (WBS 50.02).
- CRM-WA-01.03/04: vínculo transacional idempotente e revisão humana de ambiguidades; 14 propostas de contato não significam 14 vínculos criados.
- SQL 002 continua travando multi-org; não remover ou migrar sem Product Gate, restore e autorização.

## Próximo marco candidato (não comprometido)

Homologar CRM HTTP e Workspace com identidade real e tenant A/B, sem ativar multi-org.

**Planejamento:** [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Escopo](ESCOPO.md).

## Checkpoint da auditoria

| Data | Ambiente | Evidência | Lacuna |
|---|---|---|---|
| 2026-11-12 | DevServer01 checkout `b452a03e` | Fonte e testes locais listados acima | Sem staging/CI da publicação, IAM real, restore e aceite |

## Histórico documental anterior (não confundir com auditoria atual)

> O texto abaixo foi escrito antes desta revisão e é preservado para reconciliação; seus estados podem estar desatualizados.
> **RASCUNHO DE BASELINE / SEM SPRINT COMPROMETIDA**. Escopo a aprovar: [ESCOPO.md](ESCOPO.md). Reconciliar qualquer observação com a SHA da `main` no começo do chat.

## Onde paramos?

- Código Core CRM, APIs, plugin, SQL 001–003, testes e funcionalidades de Workspace presentes no repositório.
- Aceite de desenvolvimento no backend documentado; testes de frontend com API e identidade simuladas não fecham Product Gate.
- Integração de eventos de identidade WA/Inbox demonstrada sinteticamente em PostgreSQL descartável; tratativa humana de `review_required` não operacional.
- Modo de gate CRM de módulo ainda possui compatibilidade `legacy|enforce`; Control Plane/migrations e grants reais são pré-requisitos de ativação segura.

## Para onde vamos?

**Próximo marco:** revisar/assinar o ESCOPO P01, depois confirmar SHA e lacunas atuais e homologar a jornada CRM Workspace com JWT Keycloak, OpenFGA e tenants separados.

## Estado verificável por WBS

| WBS | Evidência conhecida | Estado de entrega atual | Próxima verificação |
|---|---|---|---|
| P01.01 | `modules/core-crm/sql`, `src`, testes de PostgreSQL descritos no aceite CRM | Código/testes relatados, revalidar na SHA | Suite SQL e tenants A/B |
| P01.02 | `src/crm.controller.ts`, `capabilities`, `csv.ts` | Implementação presente; operação a homologar | HTTP real, negações, CSV |
| P01.03 | `src/whatsapp-identity-events.ts`, WBS WA/CRM | Integração sintética; cutover pendente | Eventos, grants e replay |
| P01.04 | `apps/workspace-web/src/features/crm*.tsx` | UI implementada, browser mockado | Identidade e tenant reais, teclado |
| P01.05 | Product Gate CRM explicitamente aberto | Não concluído | Demo e decisão de aceite |

## Sprint e bloqueios

- **Sprint:** não atribuída; escopo em revisão.
- **Bloqueadores:** E2E real de identidade/FGA; readiness de tenant e Control; observabilidade/restore do gate final.
- **Não executar:** migrations, habilitação de módulo real ou worker de canal sem preflight e autorização.

## Registro de checkpoints

| Data | SHA / ambiente | Mudança comprovada | Próxima ação |
|---|---|---|---|
| 2026-11-11 | Escopo analisado a partir de checkout `8549488` | Ficha impressa em revisão; sem alterações operacionais | Debater e aprovar o escopo |

**Saída do chat:** onde paramos; WBS; teste/CI/ambiente; o que bloqueia; para onde vamos; mudanças de escopo propostas para aprovação.
