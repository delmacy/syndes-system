---
title: "P14 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L33: \| `docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md` \| Decisão de evolução por perfis \| Schema CMP-02 implementado \|

> L37: 1. **CMP-01/02:** matriz de ports/dependências com sign-off e schema de profile validado offline ainda pendentes. A auditoria documental não conclui CMP-01 automaticamente.

> L40: 4. **Eventos:** migrations de tenant/Control, FGA service grants, projetor único WhatsApp, backup/restore e worker operacional dependem de gates separados.

> L42: 6. **Governança:** não transferir API, SQL, frontend, decisões de instalação ou produto dos owners A04/A08/C01/etc. para P14.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L25: \| `ModuleRegistry.register/ordered/has` \| SemVer/IDs válidos, schemas únicos, dependências e ordenação; rejeita ciclos/ausentes \|

> L26: \| `defineSyndesModule(...)`, `SyndesPlugin` \| Descriptor confiável e seus assets, permissions e migrations \|

> L50: - **Nenhum schema, migration, database ou entidade SQL é da P14.** Control DB, tenant DB (um por tenant) e schemas de módulos têm owners independentes. `platform_events` fica no banco tenant, não em Control.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **P14 não possui package.json, controller HTTP, export JavaScript, serviço NestJS ou esquema SQL.** O contrato normativo dessa unidade é o `AGENTS.md` e as decisões aprovadas. As interfaces reais abaixo possuem owners separados.

> L13: \| `ModuleRegistry.register/ordered/has` \| IDs, versões, schemas, dependências, ordem e rejeição de ciclos/ausência \| Host/owners de plugin \|

> L38: - **Eventos de domínio/Control:** são naturezas e schemas distintos; a publicação não altera automaticamente status de módulo.

> L41: Qualquer alteração em API, export, ACL, SQL, eventos ou composição cross-owner precisa de revisão, WBS/ADR/PR e suites de consumidores. Esta auditoria **não** altera contratos executáveis.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L67: Os artefatos em `apps/core-host/src/platform-event-*.ts` e os contratos em `packages/core-kernel/src/*events.ts` existem; **não existe scheduler automático liberado nem worker operacional homologado**. As migrations do tenant e do Control têm owners e pré-requisitos distintos, sem permissão de aplicar DDL só por documentar.

> L86: - **P14 não tem PostgreSQL, migration ou tabela própria.** Control DB, schema `platform_events` no tenant e migrations dos módulos têm owners separados.

> L89: - **Segurança:** para ativação de perfis/workers exige Control ENABLED, FGA service grants, schema migrado com backup/restore, canário e rollback autorizados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
