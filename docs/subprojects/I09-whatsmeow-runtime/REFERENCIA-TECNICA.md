# I09 — Whatsmeow runtime | Referência técnica

> **COMPONENTE TÉCNICO DO P03 — WHATSAPP.** Este documento histórico I09 permanece acessível para WBS, commits e links antigos. O gateway Go/Whatsmeow faz parte de [P03 — WhatsApp](../P03-whatsapp/README.md), com [Referência técnica](../P03-whatsapp/REFERENCIA-TECNICA.md) e [Operação](../P03-whatsapp/OPERACAO.md) centrais. Não representa outro módulo de produto.


> **INVENTÁRIO DOCUMENTAL NÃO AUDITADO.** Só descreve arquivos/declarações presentes no repositório; não representa funcionalidade implantada.

## Stack e ownership

- **Fonte:** [modules/whatsapp/gateway](https://github.com/delmacy/syndes-system/tree/main/modules/whatsapp/gateway) — diretório.
- **Owner:** declarado em `catalog/work-units.json`. Contratos públicos de outros owners não podem ser alterados diretamente.
- **Stack/manifests:** não foi encontrado package.json nesta fonte; auditar o artefato antes de declarar framework.

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

## Evidência incremental — receiver inbound (15/11/2026)
- [Auditoria I09-DOC-01](https://github.com/delmacy/syndes-system/blob/audit/i09-callback-doc-drift-20261115-2055/docs/audits/I09-CALLBACK-DOCUMENTATION-DRIFT-20261115-2055.md): `modules/whatsapp/src/inbound-http.ts` declara `POST /api/v1/internal/whatsapp/events/:tenantId`, com bearer e validação de envelope, tenant e conta. `src/plugin.ts` importa o módulo e `apps/core-host/config/modules.json` lista o plugin. O README de 02/11 que afirma ausência é um retrato histórico, não uma descrição atual.
- O serviço Nest inspecionado instancia o store sem o bridge transacional opcional: não atribuir ao receiver ativo as garantias do caminho com bridge sem teste. O worker de despacho só inicia timer com `WHATSAPP_DISPATCH_ENABLED=true`; valor de ambiente não verificado.
- O `go.mod` está em `modules/whatsapp/gateway/whatsmeow/go.mod`; migrations tenant 001–008 são declaradas pelo plugin, **não** comprovadamente aplicadas. HTTP 401/400/404/503 são respostas declaradas, não smoke operacional.
- **Limites:** auditoria parcial de fontes, sem Go/Node/CI executados nesta rodada, sem evidência de receiver registrado, compatibilidade ponta a ponta, implantação, homologação ou SHA de Pages. P03 é o owner documental do produto; I09 permanece componente técnico subordinado.
