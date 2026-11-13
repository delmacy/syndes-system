---
title: "G01 · Frontend e interfaces"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Frontend e interfaces

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L11: \| **Arquitetura de componentes** \| **Código e configuração encontrados** \| Kernel/Host/plugins/frontends presentes no checkout; a presença em Git não prova operação \|

> L28: **Referências normativas consultadas:** [Core Framework](../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md), [composição do Core](../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md), [Control/Tenant](../../engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md), [frontend/backend](../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md), [schemas](../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMA

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L9: - **Arquitetura observada:** `packages/core-kernel` como biblioteca de contratos, `apps/core-host` como composition root NestJS e `modules/*` como pacotes de domínio. Ver [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) e [mapa da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

> L38: **G01 não possui frontend operacional.** A apresentação do portal é o Syndes Docs; as aplicações são A01 Workspace, A02 Platform Manager e A03 Support, com `packages/front-shared` restrito a componentes visuais. Identidade, sessão e controle de recursos não podem atravessar bundles por simples reuso de UI.

> L45: - **Eventos:** `platform_events` no tenant e `control_events` no Control têm owners e gates distintos. Ver [matriz de dados da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

> L49: - [Diagrama e matrizes](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) são **lógicos**, não desenho de infraestrutura homologada.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [03-capabilities.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/03-capabilities.md)

> L11: \| Isolamento de frontends por contexto \| [ADR frontend/backend](../../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md), `apps/master-admin-web`, `apps/workspace-web`, `packages/front-shared` \| Estruturas de projeto presentes; sessão real não verificada \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L47: - Frentes distintas: `apps/master-admin-web` (global), `apps/workspace-web` (tenant) e `apps/support-web` (Support), conforme escopo. `packages/front-shared` compartilha apenas componentes e estilos.

> L54: - Ativação de módulo por entitlement + installation + ENABLED + grants na borda HTTP, workers e frontend.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
