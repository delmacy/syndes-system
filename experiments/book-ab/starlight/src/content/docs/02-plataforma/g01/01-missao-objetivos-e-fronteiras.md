---
title: "G01 · Missão e fronteiras"
description: "Volume Plataforma e core · capítulo G01 · matéria 01"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/01-missao-objetivos-e-fronteiras.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 1. Missão, objetivos e fronteiras

### Missão da G01

Manter o **mapa arquitetural verificável do Syndes**, suas decisões, invariantes, limites de ownership e dependências entre áreas. Transformar ADRs aprovadas em **regras de integração rastreáveis** e registrar proposições ainda pendentes, sem reimplementar a lógica dos módulos.

**Natureza:** G01 é uma unidade de governança localizada em `docs/engineering`; **não** tem package de runtime, endpoints HTTP ou tabelas próprias. O desenho de software é executado por A08 Core Kernel, A04 Core Host, C01–C08, apps, modules e infraestrutura sob seus próprios owners.

### Dentro e fora do escopo

| G01 deve fazer | G01 não deve fazer |
|---|---|
| Descrever fronteiras de Control Plane, Tenant Plane, módulos e apps | Criar um segundo Core, Manager, backend genérico ou frontend por módulo |
| Identificar fontes de verdade, status da decisão, ADR, dependências e interfaces | Reatribuir ownership de P01/P02/P03, C03–C06 ou I02 |
| Exigir contratos públicos, isolamento, segurança, compatibilidade e testes | Declarar deployments, grants, migrations ou Product Gates aprovados sem evidência |
| Manter matriz de conformidade e riscos arquiteturais | Executar DDL, migrar tenant, ativar workers ou publicar segredos |
| Manter links para APIs, classes, métodos, schemas e eventos do **owner** | Copiar para G01 o conteúdo técnico normativo de cada unidade |

### Decisões documentadas e estado de implementação

- **Decisão arquitetural:** Kernel agnóstico, Host NestJS como composition root e módulos de negócio em packages confiáveis. Referências: [Core Framework](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/CORE-FRAMEWORK-ARCHITECTURE.md) e [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md). O arquivo `apps/core-host/config/modules.json` declara atualmente cinco plugins trusted (CRM, Inbox, WhatsApp, Organizations e Support); **lista de plugins não é prova de serviço habilitado num tenant**.
- **Fronteira de dados:** Control DB administra metadados/plataforma; dados de negócio em bancos PostgreSQL próprios de tenant. Schemas por módulo são evolução **parcial/proposta**, não assumir conversão concluída dos schemas `public`. Referência: [ADR de schemas](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md).
- **Fronteira de confiança:** Manager e Workspace são apps separados; `front-shared` compartilha apenas apresentação, não identidade, sessão ou regras. Referência: [ADR frontend/backend](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md).
- **Event Bus:** contratos tipados, transactional outbox por tenant e ledger Control distintos. Código candidato e testes descartáveis **não** são ativação operacional. Referências: [tenant events](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-PLATFORM-EVENTS-20261111.md) e [Control events](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md).

### Consumidores e responsabilidades

Engenharia/Tech Lead usa G01 para planejar mudanças; os owners usam G01 para conferir contratos e limites; Produto revisa consequências e Product Gates; Segurança/Operação verifica riscos de tenants, autorização, migrations e releases. **A aprovação de cada escopo funcional continua no módulo de produto responsável.**

**Situação da revisão:** descrição arquitetural **reconciliada parcialmente com fontes do repositório** em 12/11/2026; não constitui homologação de nenhuma aplicação.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/01-missao-objetivos-e-fronteiras.md).
