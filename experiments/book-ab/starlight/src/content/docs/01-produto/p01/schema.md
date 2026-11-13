---
title: "P01 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)

> L7: Código de CRM com plugin NestJS, pessoa/organização, notas, tags, canais, CSV, SQL 001–003 e UI Workspace. Não comprovada nesta auditoria uma jornada autenticada real de CRM ou ativação multi-org.

> L16: \| `modules/core-crm/sql` \| Artefato presente no checkout; não implica runtime habilitado \|

> L25: - SQL 002 continua travando multi-org; não remover ou migrar sem Product Gate, restore e autorização.

> L46: - Código Core CRM, APIs, plugin, SQL 001–003, testes e funcionalidades de Workspace presentes no repositório.

> L49: - Modo de gate CRM de módulo ainda possui compatibilidade `legacy\|enforce`; Control Plane/migrations e grants reais são pré-requisitos de ativação segura.

> L59: \| P01.01 \| `modules/core-crm/sql`, `src`, testes de PostgreSQL descritos no aceite CRM \| Código/testes relatados, revalidar na SHA \| Suite SQL e tenants A/B \|

> L69: - **Não executar:** migrations, habilitação de módulo real ou worker de canal sem preflight e autorização.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/REFERENCIA-TECNICA.md)

> L41: \| Banco \| Ownership \| Tabelas principais / migration \|

> L43: \| **Tenant DB** \| CRM \| `crm_people`, `crm_organizations`, `crm_person_organizations`, `crm_audit` — `sql/001_crm_foundation.sql` \|

> L44: \| **Tenant DB** \| CRM \| Tags/notas — `sql/002_crm_tags_notes.sql` \|

> L45: \| **Tenant DB** \| CRM (transicional) \| `crm_employees`, identidades de canal — `sql/003_crm_employees_channels.sql` \|

> L46: \| **Control/Manager DB** \| Nenhuma tabela própria CRM \| Entitlements e tenancy pertencem ao Control Plane; consulta via contrato confiável \|

> L51: - Dívida prioritária: tirar conceito de trabalhador interno da semântica CRM sem quebrar `platform_staff_identity_links` nem migrations existentes.

> L52: - Fontes: [service.ts](https://github.com/delmacy/syndes-system/blob/main/modules/core-crm/src/service.ts), [index.ts](https://github.com/delmacy/syndes-system/blob/main/modules/core-crm/src/index.ts), [SQL](https://github.com/delmacy/syndes-system/tree/main/modules/core-crm/sql).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
