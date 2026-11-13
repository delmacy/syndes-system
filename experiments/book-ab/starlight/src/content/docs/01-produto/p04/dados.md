---
title: "P04 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/REFERENCIA-TECNICA.md)

> L8: - **Stack:** TypeScript / NestJS, `@syndes/core-kernel`, banco PostgreSQL de tenant.

> L41: \| **Tenant DB** \| `platform_organizations`, `platform_org_memberships`, `platform_workspaces`, `platform_workspace_memberships`, `platform_units` — SQL 001 \| Migrável por módulo com gates \|

> L42: \| **Tenant DB** \| `platform_staff_teams`, `platform_staff_team_members`, `platform_staff_team_workspaces`, `platform_staff_identity_links`, `platform_workspace_staff_roles` — `modules/organizations/sql/007_staff_roles_pre_release.sql` \| Manual pré-release, não assumir aplicada \|

> L43: \| **Tenant DB** \| SQL 002 `platform_legacy_single_organization/workspace` \| Trava física legada; não desproteger \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L2: - Componentes, ownership de dados, migrations e autorização: A VERIFICAR.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
