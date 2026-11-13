---
title: "G01 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L26: \| `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` \| Tipos/validação de contratos de eventos \| Dispatcher ativo, migrations aplicadas ou replay operacional \|

> L28: **Referências normativas consultadas:** [Core Framework](../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md), [composição do Core](../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md), [Control/Tenant](../../engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md), [frontend/backend](../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md), [schemas](../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMA

> L34: 3. Schemas PostgreSQL por módulo e migração de tabelas `public` são evolução por gates; **não há evidência nesta auditoria de migração completa nem de ACL aplicada no ambiente**.

> L43: - Nenhum módulo de produto, SQL, workflow geral ou serviço operacional foi alterado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** G01 mantém decisões e matrizes, não é serviço, package executável, controlador HTTP nem schema PostgreSQL. As referências a classes e interfaces abaixo pertencem aos seus respectivos owners e foram examinadas no commit `b73f42adf47a9b766790f399e13529b470aef171`; não comprovam instalação operacional.

> L42: - **G01:** nenhuma tabela/migration própria; não existe banco de dados de arquitetura.

> L44: - **Tenant DB:** banco por tenant; o desenho de schemas por módulo é evolutivo e não deve ser declarado aplicado só porque existe um ADR.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/04-contratos-e-dependencias-publicas.md)

> L25: 3. [ADR Kernel/schemas](../../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md) descreve schemas por módulo como evolução incremental, enquanto SQL histórico ainda utiliza `public`. **Não afirmar isolamento por schema aplicado** até a migração e os grants serem verificados em banco real.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L28: \| `syndes_control` \| C01, APIs de Control; migrations por fase/candidato \| Metadados de catálogo, contas, installs/grants; sem conteúdo CRM/Inbox/WhatsApp \|

> L30: \| Tabelas de domínio \| P01/P02/P03/P04/P05/P06 \| Escrita pelo owner; parte do SQL histórico está no schema `public`, não assumir conversão \|

> L32: \| `control_events` no Control DB \| C01; migration `006_control_events` candidata \| Só eventos administrativos globais; não misturar dados de domínio tenant \|

> L33: \| `_syndes` / schemas por módulo \| [ADR de schemas](../../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md) \| Ledger/ACL e schema-alvo em evolução; não declarar aplicado \|

> L40: \| Manager \| Manager API/Control Plane \| API administrativa, client OIDC e role SQL separados \| Sem leitura de banco de tenant por privilégio global \|

> L53: - Isolamento real entre Control e Tenant DB, ACL, usuários SQL e Keycloak/OpenFGA, incluindo testes negativos e tenant A/B.

> L56: - Perfis de composição, migração por schema e gates de multi-org permanecem **evoluções controladas**, não invariantes comprovadas no deploy.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
