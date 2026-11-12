# G02 — Produto e UX | Referência técnica

> **AUDITORIA DOCUMENTAL E DE FONTE ESTÁTICA PARCIAL — 12/11/2026.** Revisão do checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`. G02 é governança de requisitos, experiências e Product Gates, **não** pacote executável. Nenhuma verificação de UX com identidade real, deploy ou banco operacional foi executada nesta auditoria.

## Stack e ownership

- **Owner G02:** `docs/product` conforme `catalog/work-units.json`. Arquivos Markdown/PRD e decisões são a fonte documental; **não há `package.json`, API HTTP, classes ou migrations próprios da G02**.
- **Atores e superfícies reais a conferir:** `apps/workspace-web` (A01), `apps/master-admin-web` (A02) e `apps/support-web` (A03). Componentes de apresentação em `packages/front-shared` (A07).
- **Fonte de produto:** [MVP-SCOPE](https://github.com/delmacy/syndes-system/blob/main/docs/product/MVP-SCOPE.md) e [MODULE-ORDER](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md), com inclusão de PRD-003A em 11/11 e F0–F8 congelado.

## Classes, métodos e responsabilidades

**G02 não exporta classes/métodos.** A leitura estática identificou os seguintes arquivos de UI sob seus owners:

| Superfície | Arquivos presentes no checkout | Responsabilidade de produto / evidência |
|---|---|---|
| A01 Workspace | `apps/workspace-web/src/App.tsx`, `src/features/crm.tsx`, `crm-person-detail.tsx` | CRM e operações por capability; gates reais no P01/A01 |
| A01 Inbox | `apps/workspace-web/src/features/inbox.tsx`, `inbox-thread.ts`, `inbox-rules.ts`, `inbox-context.tsx` | Conversa, fila, handoff, contexto e interface; gates P02/A01 |
| A01 WhatsApp | `apps/workspace-web/src/features/whatsapp-accounts.tsx` | Presença de UI; canal operacional depende P03 e grants |
| A02 Manager | `apps/master-admin-web/src/App.tsx`, `src/app/ManagerShell.tsx` | Admin global; leitura de tenant não implica leitura do conteúdo |
| A03 Support | `apps/support-web/src/App.tsx`, `src/api.ts` | Cases/filas da própria Syndes; owner P06/A03 |
| A07 Front Shared | `packages/front-shared/package.json` | Componentes de apresentação; sem compartilhamento de sessão/identidade |

Código presente em arquivo e relatos históricos de testes **não provam** que a jornada esteja publicada, autorizada ou homologada.

## APIs HTTP, contratos e eventos

**G02 não registra endpoint HTTP, evento, módulo Nest nem `package.json#exports`.** Seus contratos são de comportamento e aceite, mantidos nos PRDs. APIs e contracts são implementados e versionados por P01, P02, P03, P05, P06, A04/A05 e C01/C06. Ver [Catálogo de APIs](../../blueprint/APIS.md) e [Contratos por módulo](../../blueprint/CATALOGO-MODULOS.md).

- A Inbox é dona de `Conversation`/`Message`, o CRM é dono de `Person`/organizações comerciais, e P05 é dono de protocolo e etapas.
- Realtime SSE descrito em [checkpoint Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md) está registrado como incremento local com gates reais pendentes.
- JWT, FGA, tenant/org/workspace e ENABLED são controles do backend; **mostrar/ocultar botão no React não substitui autorização**.

## Frontend: páginas, navegação e estados

**Fluxo de consulta:** [especificação e histórias G02](ESCOPO.md), [matriz de UX](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md), [CRM](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-FRONTEND-COMPLETION.md) e [Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md). O desenho de produto mantém Workspace para Account/Organization/Workspace, Manager e Support como apps separados por público.

Estados de carregamento/erro/negação e adaptação mobile precisam ser verificados por módulo e papel. Capturas/mock de frontend não comprovam autorização com Keycloak e OpenFGA reais.

## Schemas e migrations

**G02 não possui database, schema ou migration.** As fontes de dados pertencem aos respectivos domínios e ao Control Plane. `Platform Organization` não é `CRM Organization`; `Conversation` não é `Attendance Protocol`. Não inferir dados operacionais de telas previstas ou de diagramas.

## Critérios de qualidade e pendências

- [STATUS](STATUS.md) distingue documentação, implementação, integração, operação e Product Gate.
- [EVOLUCAO](EVOLUCAO.md) relaciona WBS, sem promover estados por inferência.
- [Escopo aprovado/planejado](ESCOPO.md) e [gates](chapters/06-wbs-marcos-e-aceite.md) exigem evidência por SHA/ambiente.
- **Não verificado nesta auditoria:** identidade/autorização real, cenário multitenant, recuperação, performance, acessibilidade completa e cliente comercial pagante.
