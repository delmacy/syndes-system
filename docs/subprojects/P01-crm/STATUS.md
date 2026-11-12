# P01 — CRM | STATUS

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
