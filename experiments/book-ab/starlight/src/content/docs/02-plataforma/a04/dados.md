---
title: "A04 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)

> L11: \| Dados \| `TenantPgProvider`, `resolveRegistry`, adapters Control \| Migrations e grants efetivos não verificados \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/REFERENCIA-TECNICA.md)

> L7: - **Owner:** `apps/core-host` (NestJS/TypeScript/Node/pg). É o host de composição, **não** owner dos dados ou regras CRM/Inbox/WhatsApp/Organizations/Support.

> L41: - **Control/Manager DB:** catálogo, membership, lifecycle e instalação são acessados por portas; migrations Control pertencem aos seus owners e à infraestrutura PostgreSQL.

> L42: - **Tenant DB:** `TenantPgProvider` usa registro e credencial dedicada; schemas CRM/Inbox/WhatsApp/Organizations não são owned pelo A04.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/OPERACAO.md)

> L9: 3. Em PostgreSQL 17 **segregado**, confrontar migrations Control/Tenant, roles/grants e `TenantPgProvider` com testes de isolamento, sem usar dados reais.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
