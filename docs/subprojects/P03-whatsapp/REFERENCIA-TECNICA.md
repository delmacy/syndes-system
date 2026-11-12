# P03 — WhatsApp | Referência técnica

> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [modules/whatsapp](https://github.com/delmacy/syndes-system/tree/main/modules/whatsapp) — diretório.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Pacote:** `@syndes/whatsapp`.
- **Manifesto:** [modules/whatsapp/package.json](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/package.json).

### Exports declarados no manifesto

| Subpath | Alvo | Evidência |
|---|---|---|
| `.` | `./dist/accounts.js` | Declaração, não garantia de consumidor instalado |
| `./contracts` | `./dist/contracts/index.js` | Declaração, não garantia de consumidor instalado |
| `./crm-link-plan` | `{"types": "./dist/crm-link-plan.d.ts", "default": "./dist/crm-link-plan.js"}` | Declaração, não garantia de consumidor instalado |
| `./event-bridge` | `{"types": "./dist/event-bridge.d.ts", "default": "./dist/event-bridge.js"}` | Declaração, não garantia de consumidor instalado |
| `./event-identity-reader` | `{"types": "./dist/event-identity-reader.d.ts", "default": "./dist/event-identity-reader.js"}` | Declaração, não garantia de consumidor instalado |
| `./event-route-commands` | `{"types": "./dist/event-route-commands.d.ts", "default": "./dist/event-route-commands.js"}` | Declaração, não garantia de consumidor instalado |
| `./plugin` | `./dist/plugin.js` | Declaração, não garantia de consumidor instalado |

### Scripts do pacote (não executados aqui)

| Nome | Comando declarado |
|---|---|
| `build` | `tsc -p tsconfig.json` |
| `check` | `tsc --noEmit -p tsconfig.json` |
| `test` | `npm run build && node --test test/*.test.mjs` |

## Backend: classes, métodos e responsabilidades

**A AUDITAR:** inspecionar código e testes, assinaturas, parâmetros, efeitos e erros. Não publicar API privada como contrato.

## Contratos públicos, APIs e eventos

[Índice normativo de contratos](../../standards/CONTRATOS-PUBLICOS.md). Imports, endpoints e consumers exigem evidência de export, versão e compatibilidade.

## Frontend: aplicações, telas e componentes

**A AUDITAR:** conferir telas em Workspace, Manager ou Support e componentes compartilhados; não inferir rota a partir do nome da unidade.

## Schemas e migrations

### Tenant DB

Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

| Arquivo SQL encontrado | Banco/owner e estado |
|---|---|
| [001_whatsapp_accounts.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/001_whatsapp_accounts.sql) | A confirmar com o manifesto de migração |
| [002_whatsapp_inbound.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/002_whatsapp_inbound.sql) | A confirmar com o manifesto de migração |
| [003_whatsapp_outbound_inbox.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql) | A confirmar com o manifesto de migração |
| [004_whatsapp_conversation_phone.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/004_whatsapp_conversation_phone.sql) | A confirmar com o manifesto de migração |
| [005_whatsapp_history.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/005_whatsapp_history.sql) | A confirmar com o manifesto de migração |
| [006_whatsapp_contact_names.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/006_whatsapp_contact_names.sql) | A confirmar com o manifesto de migração |
| [007_whatsapp_delivery_receipts.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/007_whatsapp_delivery_receipts.sql) | A confirmar com o manifesto de migração |
| [008_whatsapp_projection_owner.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/008_whatsapp_projection_owner.sql) | A confirmar com o manifesto de migração |

### Control / Manager DB

Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

## Diagramas, testes e pendências

- [Escopo](ESCOPO.md) · [Evolução](EVOLUCAO.md) · [Status](STATUS.md) · [Histórico](HISTORICO.md).
- **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.
