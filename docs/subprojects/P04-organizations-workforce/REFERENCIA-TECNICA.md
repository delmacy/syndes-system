# P04 — Organizations & Workforce | Referência técnica

> **PILOTO · 12/11/2026.** A hierarquia empresarial é distinta de cadastros comerciais do CRM e de fornecedor ERP. Migration de Workforce 007 é **manual pré-release**, não comprovadamente aplicada ao tenant real.

## 1. Stack e fronteira

- **Owner:** `P04 Organizations & Workforce` · `modules/organizations`.
- **Stack:** TypeScript / NestJS, `@syndes/core-kernel`, banco PostgreSQL de tenant.
- **Imports públicos:** `@syndes/core-organizations` e `./plugin` por `package.json#exports`.
- **Hierarquia:** Tenant → Platform Organization → Workspaces e Teams; memberships/identidades humanas podem referenciar vários contextos.

## 2. Classes e métodos

| Serviço / fonte | Métodos selecionados | Regra |
|---|---|---|
| `OrganizationService` · `src/service.ts` | `bootstrap(ctx)`, `backfillDefaultOwnership(ctx)` | Cria/default e backfill com contexto/ator confiáveis e prevenção de elevação de acesso |
| `OrganizationService` | `createOrganization(ctx,input)`, `createWorkspace(ctx,orgId,input)` | Escrita org-scoped; operações de múltiplos contextos continuam gated |
| `OrganizationService` | `listOrganizations(ctx)`, `listWorkspaces(ctx,orgId)`, `listUnits(ctx,orgId)`, `createUnit(ctx,orgId,input)` | Leitura e criação de unidades/locais físicos, guardas do Core |
| `WorkforceService` · `src/workforce.ts` | `myProfile(ctx,org,ws)`, `bindEmployee(ctx,org,ws,employeeId,principalId)` | Associação entre funcionário e principal autenticado sem igualar as identidades |
| `WorkforceService` | `assignWorkspaceRole(ctx,org,ws,principalId,...)`, `createTeam(ctx,org,ws,name)`, `addTeamMember(ctx,org,ws,team,...)` | Papéis de negócio e equipes, sem inferir grant FGA de um título |

**Aviso:** o `WorkforceService` está no pacote, mas o comentário de código diz que **não há controller HTTP público até Product Gate**. Um método TS não significa API HTTP ou UI habilitada.

## 3. Contratos públicos e integração

- Plugin `src/plugin.ts` declara permissões para directory, bootstrap, units, workspaces e migrations 001–006.
- Controller `src/controller.ts`: rotas em `/v1/tenants/:tenantId/platform` para bootstrap, organizações, workspaces e units; Identity/Authorization são necessários antes de operação real.
- ERP Lite pode **consumir** views autorizadas de Workforce, não tomar ownership do tenant ou do principal.
- Contrato de staff e team ainda requer formalização de capacidade estável e testes de segurança.

## 4. Frontend

- Não localizei neste levantamento uma UI Workforce/Teams completa homologada. O Manager possui telas de clientes/tenants em `apps/master-admin-web/src/features/tenants/`, **mas não são telas do ERP do tenant**.
- Proposta de UI administrativa de colaboradores deve morar no `apps/workspace-web`, com componentes visuais reutilizados de `packages/front-shared`, sem acesso cruzado.
- Rota exata e permissão de cada tela: **A DEFINIR / TESTAR**, não fabricar endereço de navegador.

## 5. Schemas

| Destino | Tabela/objeto e fonte | Estado |
|---|---|---|
| **Tenant DB** | `platform_organizations`, `platform_org_memberships`, `platform_workspaces`, `platform_workspace_memberships`, `platform_units` — SQL 001 | Migrável por módulo com gates |
| **Tenant DB** | `platform_staff_teams`, `platform_staff_team_members`, `platform_staff_team_workspaces`, `platform_staff_identity_links`, `platform_workspace_staff_roles` — `modules/organizations/sql/007_staff_roles_pre_release.sql` | Manual pré-release, não assumir aplicada |
| **Tenant DB** | SQL 002 `platform_legacy_single_organization/workspace` | Trava física legada; não desproteger |
| **Control/Manager DB** | Nenhuma tabela própria de negócio da empresa | Registry e memberships gerais são do Control Plane |

## 6. Evidências e riscos

- Código e migrations presentes; operação de multi-org e Workforce HTTP exige gates de autorização, tenant A/B, rollback e restore real.
- Separar perfil profissional de `crm_employees` será mudança arquitetural aditiva aprovada, não tarefa de renomear tabela.
- Fontes: [service.ts](https://github.com/delmacy/syndes-system/blob/main/modules/organizations/src/service.ts), [workforce.ts](https://github.com/delmacy/syndes-system/blob/main/modules/organizations/src/workforce.ts), [SQL](https://github.com/delmacy/syndes-system/tree/main/modules/organizations/sql).
