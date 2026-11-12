# A07 — Front Shared | Referência técnica

> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [packages/front-shared](https://github.com/delmacy/syndes-system/tree/main/packages/front-shared) — diretório.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Pacote:** `@syndes/front-shared`.
- **Manifesto:** [packages/front-shared/package.json](https://github.com/delmacy/syndes-system/blob/main/packages/front-shared/package.json).

### Exports declarados no manifesto

| Subpath | Alvo | Evidência |
|---|---|---|
| `.` | `{"types": "./src/index.ts", "default": "./src/index.ts"}` | Declaração, não garantia de consumidor instalado |
| `./badge` | `{"types": "./src/components/badge.tsx", "default": "./src/components/badge.tsx"}` | Declaração, não garantia de consumidor instalado |
| `./button` | `{"types": "./src/components/button.tsx", "default": "./src/components/button.tsx"}` | Declaração, não garantia de consumidor instalado |
| `./card` | `{"types": "./src/components/card.tsx", "default": "./src/components/card.tsx"}` | Declaração, não garantia de consumidor instalado |
| `./input` | `{"types": "./src/components/input.tsx", "default": "./src/components/input.tsx"}` | Declaração, não garantia de consumidor instalado |
| `./separator` | `{"types": "./src/components/separator.tsx", "default": "./src/components/separator.tsx"}` | Declaração, não garantia de consumidor instalado |

### Scripts do pacote (não executados aqui)

| Nome | Comando declarado |
|---|---|
| `check` | `tsc --noEmit --project tsconfig.json` |
| `test` | `node --test test/*.test.mjs && npm run check` |

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
