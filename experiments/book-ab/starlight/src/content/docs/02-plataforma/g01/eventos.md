---
title: "G01 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L26: \| `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` \| Tipos/validação de contratos de eventos \| Dispatcher ativo, migrations aplicadas ou replay operacional \|

> L28: **Referências normativas consultadas:** [Core Framework](../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md), [composição do Core](../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md), [Control/Tenant](../../engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md), [frontend/backend](../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md), [schemas](../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMA

> L57: **Critério para subir de “auditoria parcial”:** aprovar a descrição com os owners, solucionar ou formalizar divergências, verificar a SHA integrada e registrar evidências de testes/gates relevantes. Não confundir documento publicado com Product Gate concluído.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L20: \| C06 Event Platform \| `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` \| Eventos tipados e validações, não ativação do worker \|

> L31: - [Kernel](../../subprojects/A08-core-kernel/REFERENCIA-TECNICA.md): ports, ModuleRegistry e eventos tipados.

> L33: - [Event Platform](../../subprojects/C06-event-platform/REFERENCIA-TECNICA.md): outbox, dispatcher, consumers e limites entre Control e tenant.

> L34: - **G01 não publica nem consome eventos como runtime.** Um contrato declarado em Core não comprova producer/consumer ativo.

> L45: - **Eventos:** `platform_events` no tenant e `control_events` no Control têm owners e gates distintos. Ver [matriz de dados da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Entradas:** ADRs, AGENTS, inventário do catálogo, documentação de owner, WBS, evidências de CI/ambiente e propostas de mudança. **Saídas:** decisões rastreáveis, limites de responsabilidade, diagramas, matrices de conformidade, pendências e links para a fonte. **Não há export TypeScript, API HTTP ou evento produzido pela G01.**

> L19: **Regra:** `export` em um arquivo não implica superfície pública do pacote. Confirmar `package.json#exports`, consumidor, compatibilidade, autenticação e isolamento antes de integrar. O Host deve injetar ports/consumidores; evitar imports de caminhos `src/` privados de outros owners.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L31: \| `platform_events` no DB tenant \| C06; desenho e código de outbox \| Estado de ativação operacional a confirmar no ambiente; atomicidade exige transação fixada \|

> L32: \| `control_events` no Control DB \| C01; migration `006_control_events` candidata \| Só eventos administrativos globais; não misturar dados de domínio tenant \|

> L37: \| Consumidor \| Owner / fonte de dados \| Mecanismo permitido \| Restrição \|

> L42: \| WhatsApp ↔ Inbox ↔ CRM \| Módulos P03/P02/P01 e C06 \| Contratos/versionamento + outbox/consumer autorizado \| Evitar escritas diretas cross-owner; worker não presumido ativo \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
