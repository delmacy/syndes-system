---
title: "G01 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L11: \| **Arquitetura de componentes** \| **Código e configuração encontrados** \| Kernel/Host/plugins/frontends presentes no checkout; a presença em Git não prova operação \|

> L23: \| `apps/core-host/src/module-host.ts`, `config/modules.json` \| Loader de trusted plugins, configuração fixa de CRM, Inbox, WhatsApp, Organizations, Support \| Instalação/ENABLED por tenant ou perfis de instância \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L9: - **Arquitetura observada:** `packages/core-kernel` como biblioteca de contratos, `apps/core-host` como composition root NestJS e `modules/*` como pacotes de domínio. Ver [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) e [mapa da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

> L32: - [Core Host](../../subprojects/A04-core-host/REFERENCIA-TECNICA.md): bindings dos ports, plugins trusted e configuração.

> L45: - **Eventos:** `platform_events` no tenant e `control_events` no Control têm owners e gates distintos. Ver [matriz de dados da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

> L49: - [Diagrama e matrizes](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) são **lógicos**, não desenho de infraestrutura homologada.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L49: - Nomes de configuração/variáveis precisam ser confirmados **no owner operacional**; G01 não publica valores, DSNs, credenciais, URLs de administração ou topologia sensível.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
