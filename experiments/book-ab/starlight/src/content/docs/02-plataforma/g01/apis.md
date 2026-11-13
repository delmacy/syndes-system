---
title: "G01 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L10: \| **Implementação da G01** \| **Não aplicável (governança)** \| Owner `docs/engineering` no catálogo; G01 não possui API, package de runtime nem persistência \|

> L21: \| `packages/core-kernel/src/index.ts` e `src/contracts.ts` \| Exports públicos de `CoreKernel`, `ModuleRegistry`, `TenancyPort`, `AuthorizationPort`, `TrustedTenantTransactionProvider` e `ModuleAccessPort` \| Enforcement real em todos os endpoints e workers \|

> L24: \| `modules/core-crm/package.json`, `modules/inbox/package.json`, `modules/whatsapp/package.json` \| Superfícies via `exports`; pacote Inbox = `@syndes/core-inbox` \| Rotas HTTP habilitadas, identidade ou integração \|

> L32: 1. Diagrama histórico do Core Framework menciona `apps/core-api` como futuro Host; a composição examinada é `apps/core-host`. Atualização da referência histórica **sob revisão**, não mudança de arquitetura implícita.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** G01 mantém decisões e matrizes, não é serviço, package executável, controlador HTTP nem schema PostgreSQL. As referências a classes e interfaces abaixo pertencem aos seus respectivos owners e foram examinadas no commit `b73f42adf47a9b766790f399e13529b470aef171`; não comprovam instalação operacional.

> L26: **A G01 não registra endpoints HTTP.** Os controllers pertencem ao Core Host, módulos de produto e APIs administrativas; conferir as rotas reais, middleware de autorização e montagem na [consulta de APIs por owner](../../blueprint/APIS.md). Nenhum endpoint deve ser inferido de título de ADR ou classe.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Entradas:** ADRs, AGENTS, inventário do catálogo, documentação de owner, WBS, evidências de CI/ambiente e propostas de mudança. **Saídas:** decisões rastreáveis, limites de responsabilidade, diagramas, matrices de conformidade, pendências e links para a fonte. **Não há export TypeScript, API HTTP ou evento produzido pela G01.**

> L17: \| C01/C03/C04/C05 \| ADRs de Control, Keycloak, OpenFGA e OpenBao \| Metadados e identidade, relação/recurso e segredos; contratos de infraestrutura e políticas, não API pública da G01 \|

> L23: 1. [CORE-FRAMEWORK-ARCHITECTURE.md](../../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md) ainda usa `apps/core-api` como *future composition root* em diagrama histórico, mas o Host do checkout é `apps/core-host`. **Atualizar a referência antiga em revisão própria**, preservando contexto e aprovação original.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L39: \| Workspace \| APIs tenant no Host e Account Access quando cabível \| HTTP autenticado + contexto validado \| Sem Control DB direto; menu não concede permissão \|

> L40: \| Manager \| Manager API/Control Plane \| API administrativa, client OIDC e role SQL separados \| Sem leitura de banco de tenant por privilégio global \|

> L54: - Ativação de módulo por entitlement + installation + ENABLED + grants na borda HTTP, workers e frontend.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
