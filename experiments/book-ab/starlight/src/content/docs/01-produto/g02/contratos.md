---
title: "G02 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL (produto/UX e fonte estática) — 12/11/2026.** Checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`, DevServer01/worktree isolada. Revisão dos PRDs, ADRs, fonte de React e contratos documentados. Não foram executados browser autenticado, testes de tenant real, deploy, alteração de banco ou aceite do produto.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L28: **G02 não registra endpoint HTTP, evento, módulo Nest nem `package.json#exports`.** Seus contratos são de comportamento e aceite, mantidos nos PRDs. APIs e contracts são implementados e versionados por P01, P02, P03, P05, P06, A04/A05 e C01/C06. Ver [Catálogo de APIs](../../blueprint/APIS.md) e [Contratos por módulo](../../blueprint/CATALOGO-MODULOS.md).

> L36: **Fluxo de consulta:** [especificação e histórias G02](ESCOPO.md), [matriz de UX](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md), [CRM](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-FRONTEND-COMPLETION.md) e [Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md). O desenho de produto mantém Workspace para Account/Organizatio

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **G02 não publica bibliotecas, controllers HTTP, esquemas SQL, eventos ou endpoints.** Seus artefatos públicos são decisões e **contratos de produto**: PRDs, escopo, ordem de entrega, critérios de aceite, jornadas, exclusões e Product Gates, todos versionados em `docs/product`.

> L12: \| Design do Manager/Support \| Regras de navegação e papéis por público \| A02/A03/A05/P06 \|

> L13: \| Dependências entre domínios \| Matriz de risco e ordem de entrega \| G01/A04 e owners dos contratos \|

> L28: **Contratos técnicos:** consultar as abas de [APIs](../../../blueprint/APIS.md), [Dados](../../../blueprint/DADOS.md) e [Contratos por owner](../../../blueprint/CATALOGO-MODULOS.md). Contrato citado num PRD pode ser **planejado** e não estar montado na aplicação. `package.json#exports`, fonte HTTP, events e migrations pertencem aos owners executáveis.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
