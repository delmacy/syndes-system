---
title: "P14 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L15: \| **Core Kernel A08** \| `packages/core-kernel`: `CoreKernel`, `ModuleRegistry`, ports, `SyndesPlugin`, eventos tipados \| Package privado; implementação e testes pertencem a A08 \|

> L18: \| **Eventos** \| `platform-event-*.ts`, contratos `platform-events.ts` e `control-plane-events.ts` identificados \| Worker admission/composição manual **não são scheduler ativo nem DDL produtivo** \|

> L29: \| `packages/core-kernel/src/index.ts` e `package.json#exports` \| Exports tipados do Kernel `@syndes/core-kernel` \| SDK externo publicado \|

> L40: 4. **Eventos:** migrations de tenant/Control, FGA service grants, projetor único WhatsApp, backup/restore e worker operacional dependem de gates separados.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L13: \| Plataforma de eventos \| `packages/core-kernel/src/*events.ts`, `apps/core-host/src/platform-event-*.ts` \| Contrato tipado + publicação/dispatch/manual batch **opt-in**, não scheduler automático \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> L18: \| `TrustedTenantTransactionProvider.withTransaction` \| Conexão pinned para operação e outbox atômicas \| Event publishers/consumers \|

> L30: \| `platform-event-publisher.ts` \| Publicação transacional \| Requer provider transacional, outbox no tenant DB \|

> L38: - **Eventos de domínio/Control:** são naturezas e schemas distintos; a publicação não altera automaticamente status de módulo.

> L41: Qualquer alteração em API, export, ACL, SQL, eventos ou composição cross-owner precisa de revisão, WBS/ADR/PR e suites de consumidores. Esta auditoria **não** altera contratos executáveis.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L88: - **Configuração implementada:** `apps/core-host/config/modules.json` fixo, runtime secrets/oidc/FGA configurados pelo Host. Valores de credenciais, URLs internas e grants reais **não** devem ser publicados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
