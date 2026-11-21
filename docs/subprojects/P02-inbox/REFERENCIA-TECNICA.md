# P02 — Inbox | Referência técnica

> **RECONCILIAÇÃO TÉCNICA PARCIAL · 16/11/2026, código `24018b354392`.** Esta página permanece um índice: [Ficha Mestre](FICHA-MODULO.md), [17 APIs e 19 ações](MATRIZ-ACOES.md), [inventário técnico](INVENTARIO-TECNICO.md) e [diagramas](DIAGRAMAS.md) são os documentos detalhados. O código foi inspecionado, mas **não houve teste de negócio, deploy, worker, migration nem homologação nesta edição**.

## Stack e ownership

- **Fonte:** [modules/inbox](https://github.com/delmacy/syndes-system/tree/main/modules/inbox) — diretório.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Pacote:** `@syndes/core-inbox`.
- **Manifesto:** [modules/inbox/package.json](https://github.com/delmacy/syndes-system/blob/main/modules/inbox/package.json).

### Exports declarados no manifesto

| Subpath | Alvo | Evidência |
|---|---|---|
| `.` | `{"types": "./dist/index.d.ts", "default": "./dist/index.js"}` | Declaração, não garantia de consumidor instalado |
| `./plugin` | `{"types": "./dist/plugin.d.ts", "default": "./dist/plugin.js"}` | Declaração, não garantia de consumidor instalado |

### Scripts do pacote (não executados aqui)

| Nome | Comando declarado |
|---|---|
| `build` | `tsc -p tsconfig.json` |
| `check` | `tsc --noEmit -p tsconfig.json` |
| `test` | `npm run build && node --test test/*.test.mjs` |
| `test:ui` | `node --test test/frontend.test.mjs` |

## Backend: classes, métodos e responsabilidades

**DECLARADO NO CÓDIGO:** `InboxService`, `InboxHost`, `InboxController`, `PgInboxRepository`, `InboxDefaultContextGuard`, `InboxChangeBus` e 2 consumers de eventos. Assinaturas, ownership, limites e contratos nas 19 [fichas de ação](MATRIZ-ACOES.md) e no [inventário](INVENTARIO-TECNICO.md). Classes internas não são imports públicos.

## Contratos públicos, APIs e eventos

[Índice normativo de contratos](../../standards/CONTRATOS-PUBLICOS.md). O [inventário técnico](INVENTARIO-TECNICO.md) registra as 18 rotas declaradas do controller, recursos FGA por operação e os contratos `whatsapp.message.received.v2`, `inbox.participant.observed.v1`, `crm.person.resolved.v1`. Essas declarações não atestam worker/Host ativos.

## Frontend: aplicações, telas e componentes

**CÓDIGO IDENTIFICADO:** `apps/workspace-web/src/features/inbox.tsx` (fila, busca, contatos, composer, mensagens, atribuição, favoritos e Inspector P05) e assets legados `modules/inbox/public`. **PENDENTE** validar browser autenticado, dados reais, CSS/UX mobile e compatibilidade por ambiente.

## Schemas e migrations

### Tenant DB

Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

| Arquivo SQL encontrado | Banco/owner e estado |
|---|---|
| [001_inbox_foundation.sql](https://github.com/delmacy/syndes-system/blob/main/modules/inbox/sql/001_inbox_foundation.sql) | Declarado no `src/plugin.ts` para Tenant DB; possui `inbox_conversations`, `inbox_messages`, `inbox_events` e FK tenant-qualified a CRM. Aplicação real **NÃO COMPROVADA**; colunas operacionais de versões posteriores exigem reconciliação de migrations externas. |

### Control / Manager DB

Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

## Diagramas, testes e pendências

- [Escopo](ESCOPO.md) · [Evolução](EVOLUCAO.md) · [Status](STATUS.md) · [Histórico](HISTORICO.md).
- **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

## Reconciliação de estado e defasagens — 16/11/2026

- [Ficha Mestre](FICHA-MODULO.md) e [matriz](MATRIZ-ACOES.md) representam **18 rotas HTTP + 2 consumers** reconciliados em 21/11/2026 na SHA `5c4efc5d`.
- O README base do pacote descreve uma fundação anterior: os recursos atuais são `inbox:conversations`, `inbox:messages`, `inbox:notes`, `inbox:assignment`, `inbox:simulation` e `inbox:metrics`. Não assumir `inbox:conversations/assign` ou `inbox:messages/reply` como permissões provisionadas.
- A SQL 001 não contém todas as colunas de WA/organização/workspace usadas pelas queries atuais; [inventário](INVENTARIO-TECNICO.md) aponta a lacuna, sem alegar migrations executadas.
- O [STATUS](STATUS.md) distingue 34 testes históricos e os bloqueios de Product Gate, sem confundir compilação do portal com validação operacional P02.
