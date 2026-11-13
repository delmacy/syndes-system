---
title: "P14 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L17: \| **Módulos e Tenant/Control** \| Implementação dividida por owners; Control ENABLED, membership/FGA/tenancy e tenant DB têm gates próprios \| `executeModule` é opt-in; não declarar enforcement universal sem testar cada endpoint \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L14: \| Domínio \| `modules/core-crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service-management` \| API, persistência e comportamento próprios, sob seus owners \|

> L28: \| `validatePlatformEvent`, `validateControlPlaneEvent` \| Envelopes versionados para planos de dados distintos \|

> L50: - **Nenhum schema, migration, database ou entidade SQL é da P14.** Control DB, tenant DB (um por tenant) e schemas de módulos têm owners independentes. `platform_events` fica no banco tenant, não em Control.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> L19: \| `validatePlatformEvent/validateControlPlaneEvent` \| Envelopes tipados/versionados, grupos de dados distintos \| Produtores/consumidores autorizados \|

> L30: \| `platform-event-publisher.ts` \| Publicação transacional \| Requer provider transacional, outbox no tenant DB \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L86: - **P14 não tem PostgreSQL, migration ou tabela própria.** Control DB, schema `platform_events` no tenant e migrations dos módulos têm owners separados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
