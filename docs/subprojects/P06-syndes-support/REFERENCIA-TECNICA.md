# P06 — Syndes Support | Referência técnica

> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [modules/support](https://github.com/delmacy/syndes-system/tree/main/modules/support) — diretório.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Pacote:** `@syndes/core-support`.
- **Manifesto:** [modules/support/package.json](https://github.com/delmacy/syndes-system/blob/main/modules/support/package.json).

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
| [001_support_cases.sql](https://github.com/delmacy/syndes-system/blob/main/modules/support/sql/001_support_cases.sql) | A confirmar com o manifesto de migração |

### Control / Manager DB

Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

## Diagramas, testes e pendências

- [Escopo](ESCOPO.md) · [Evolução](EVOLUCAO.md) · [Status](STATUS.md) · [Histórico](HISTORICO.md).
- **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.
