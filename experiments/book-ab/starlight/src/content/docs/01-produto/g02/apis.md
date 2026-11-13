---
title: "G02 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L10: \| **Implementação da G02** \| **Não aplicável (governança)** \| `docs/product` é fonte de documentação; não package, API ou tabela operacional \|

> L35: 5. **Manager versus Workspace:** públicos, autenticação e API distintos; papel global não libera dados privados.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L7: - **Owner G02:** `docs/product` conforme `catalog/work-units.json`. Arquivos Markdown/PRD e decisões são a fonte documental; **não há `package.json`, API HTTP, classes ou migrations próprios da G02**.

> L21: \| A03 Support \| `apps/support-web/src/App.tsx`, `src/api.ts` \| Cases/filas da própria Syndes; owner P06/A03 \|

> L28: **G02 não registra endpoint HTTP, evento, módulo Nest nem `package.json#exports`.** Seus contratos são de comportamento e aceite, mantidos nos PRDs. APIs e contracts são implementados e versionados por P01, P02, P03, P05, P06, A04/A05 e C01/C06. Ver [Catálogo de APIs](../../blueprint/APIS.md) e [Contratos por módulo](../../blueprint/CATALOGO-MODULOS.md).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **G02 não publica bibliotecas, controllers HTTP, esquemas SQL, eventos ou endpoints.** Seus artefatos públicos são decisões e **contratos de produto**: PRDs, escopo, ordem de entrega, critérios de aceite, jornadas, exclusões e Product Gates, todos versionados em `docs/product`.

> L28: **Contratos técnicos:** consultar as abas de [APIs](../../../blueprint/APIS.md), [Dados](../../../blueprint/DADOS.md) e [Contratos por owner](../../../blueprint/CATALOGO-MODULOS.md). Contrato citado num PRD pode ser **planejado** e não estar montado na aplicação. `package.json#exports`, fonte HTTP, events e migrations pertencem aos owners executáveis.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
