---
title: "P01 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)

> L48: - Integração de eventos de identidade WA/Inbox demonstrada sinteticamente em PostgreSQL descartável; tratativa humana de `review_required` não operacional.

> L59: \| P01.01 \| `modules/core-crm/sql`, `src`, testes de PostgreSQL descritos no aceite CRM \| Código/testes relatados, revalidar na SHA \| Suite SQL e tenants A/B \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/REFERENCIA-TECNICA.md)

> L3: > **PILOTO · 12/11/2026.** Inventário parcial de interfaces e persistência. Dados profissionais em `crm_employees` são herança arquitetural a reconciliar com Workforce/ERP Lite, **não objeto de migração aprovada**.

> L8: - **Stack:** TypeScript 5.9, módulo NestJS `CrmHttpModule`, repositório PostgreSQL e contratos do `@syndes/core-kernel`.

> L22: \| `PgCrmRepository` / `PgCrmRepositoryFactory` \| Repositório TS em `src/postgres.ts` \| Persistência tenant-scoped, detalhes internos não expostos como contrato por arquivo \|

> L37: - **Manager:** nenhuma tela CRM global deve ler dados do tenant diretamente; a camada Manager tem contexto próprio.

> L43: \| **Tenant DB** \| CRM \| `crm_people`, `crm_organizations`, `crm_person_organizations`, `crm_audit` — `sql/001_crm_foundation.sql` \|

> L44: \| **Tenant DB** \| CRM \| Tags/notas — `sql/002_crm_tags_notes.sql` \|

> L45: \| **Tenant DB** \| CRM (transicional) \| `crm_employees`, identidades de canal — `sql/003_crm_employees_channels.sql` \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
