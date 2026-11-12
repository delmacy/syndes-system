# A01 — Workspace Frontend | Referência técnica

> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [apps/workspace-web](https://github.com/delmacy/syndes-system/tree/main/apps/workspace-web) — diretório.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Pacote:** `workspace-web`.
- **Manifesto:** [apps/workspace-web/package.json](https://github.com/delmacy/syndes-system/blob/main/apps/workspace-web/package.json).

### Scripts do pacote (não executados aqui)

| Nome | Comando declarado |
|---|---|
| `build` | `tsc -b && vite build` |
| `dev` | `vite` |
| `lint` | `oxlint` |
| `prebuild` | `node ../../packages/front-shared/scripts/ensure-installed.mjs` |
| `predev` | `node ../../packages/front-shared/scripts/ensure-installed.mjs` |
| `preview` | `vite preview` |
| `test` | `node --test tests/*.test.mjs ../../packages/front-shared/test/*.test.mjs` |
| `test:crm-ui` | `node tests/crm-ui-smoke.mjs` |
| `test:inbox-ui` | `node tests/inbox-ui-smoke.mjs` |
| `test:live-readiness` | `node tests/live-readiness.mjs` |
| `test:smoke` | `node tests/browser-smoke.mjs` |
| `test:ui-anon` | `node tests/anonymous-smoke.mjs` |
| `test:whatsapp-ui` | `node tests/whatsapp-sidebar-regression.mjs` |

## Backend: classes, métodos e responsabilidades

**A AUDITAR:** inspecionar código e testes, assinaturas, parâmetros, efeitos e erros. Não publicar API privada como contrato.

## Contratos públicos, APIs e eventos

[Índice normativo de contratos](../../standards/CONTRATOS-PUBLICOS.md). Imports, endpoints e consumers exigem evidência de export, versão e compatibilidade.

## Frontend: aplicações, telas e componentes

**A AUDITAR:** conferir telas em Workspace, Manager ou Support e componentes compartilhados; não inferir rota a partir do nome da unidade.

## Schemas e migrations

### Tenant DB

Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

Nenhuma migration em subpasta SQL nesta fonte; isso **não** comprova ausência de persistência.

### Control / Manager DB

Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

## Diagramas, testes e pendências

- [Escopo](ESCOPO.md) · [Evolução](EVOLUCAO.md) · [Status](STATUS.md) · [Histórico](HISTORICO.md).
- **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.
