---
title: "G01 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L10: \| **Implementação da G01** \| **Não aplicável (governança)** \| Owner `docs/engineering` no catálogo; G01 não possui API, package de runtime nem persistência \|

> L12: \| **Integração** \| **Não verificada nesta auditoria** \| G01 não executou testes reais Keycloak/OpenFGA, PostgreSQL tenant A/B ou fluxo de Event Bus \|

> L34: 3. Schemas PostgreSQL por módulo e migração de tabelas `public` são evolução por gates; **não há evidência nesta auditoria de migração completa nem de ACL aplicada no ambiente**.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** G01 mantém decisões e matrizes, não é serviço, package executável, controlador HTTP nem schema PostgreSQL. As referências a classes e interfaces abaixo pertencem aos seus respectivos owners e foram examinadas no commit `b73f42adf47a9b766790f399e13529b470aef171`; não comprovam instalação operacional.

> L42: - **G01:** nenhuma tabela/migration própria; não existe banco de dados de arquitetura.

> L43: - **Control Plane:** dados de catálogo e governança sob C01/Manager; não é backend de CRM, Inbox e WhatsApp.

> L44: - **Tenant DB:** banco por tenant; o desenho de schemas por módulo é evolutivo e não deve ser declarado aplicado só porque existe um ADR.

> L45: - **Eventos:** `platform_events` no tenant e `control_events` no Control têm owners e gates distintos. Ver [matriz de dados da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L32: \| `control_events` no Control DB \| C01; migration `006_control_events` candidata \| Só eventos administrativos globais; não misturar dados de domínio tenant \|

> L37: \| Consumidor \| Owner / fonte de dados \| Mecanismo permitido \| Restrição \|

> L53: - Isolamento real entre Control e Tenant DB, ACL, usuários SQL e Keycloak/OpenFGA, incluindo testes negativos e tenant A/B.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
