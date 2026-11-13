---
title: "P04 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/REFERENCIA-TECNICA.md)

> L3: > **PILOTO · 12/11/2026.** A hierarquia empresarial é distinta de cadastros comerciais do CRM e de fornecedor ERP. Migration de Workforce 007 é **manual pré-release**, não comprovadamente aplicada ao tenant real.

> L26: - Plugin `src/plugin.ts` declara permissões para directory, bootstrap, units, workspaces e migrations 001–006.

> L39: \| Destino \| Tabela/objeto e fonte \| Estado \|

> L41: \| **Tenant DB** \| `platform_organizations`, `platform_org_memberships`, `platform_workspaces`, `platform_workspace_memberships`, `platform_units` — SQL 001 \| Migrável por módulo com gates \|

> L42: \| **Tenant DB** \| `platform_staff_teams`, `platform_staff_team_members`, `platform_staff_team_workspaces`, `platform_staff_identity_links`, `platform_workspace_staff_roles` — `modules/organizations/sql/007_staff_roles_pre_release.sql` \| Manual pré-release, não assumir aplicada \|

> L43: \| **Tenant DB** \| SQL 002 `platform_legacy_single_organization/workspace` \| Trava física legada; não desproteger \|

> L44: \| **Control/Manager DB** \| Nenhuma tabela própria de negócio da empresa \| Registry e memberships gerais são do Control Plane \|

> L48: - Código e migrations presentes; operação de multi-org e Workforce HTTP exige gates de autorização, tenant A/B, rollback e restore real.

> L49: - Separar perfil profissional de `crm_employees` será mudança arquitetural aditiva aprovada, não tarefa de renomear tabela.

> L50: - Fontes: [service.ts](https://github.com/delmacy/syndes-system/blob/main/modules/organizations/src/service.ts), [workforce.ts](https://github.com/delmacy/syndes-system/blob/main/modules/organizations/src/workforce.ts), [SQL](https://github.com/delmacy/syndes-system/tree/main/modules/organizations/sql).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L2: - Componentes, ownership de dados, migrations e autorização: A VERIFICAR.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P04-organizations-workforce/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
