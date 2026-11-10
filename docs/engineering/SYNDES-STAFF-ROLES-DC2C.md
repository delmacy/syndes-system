# Syndes Operations — DC-2c: identidades, papéis e equipes por workspace

Data: 2026-11-09. Status: implementação em desenvolvimento, **sem implantação de módulos ou migração em tenant operacional**. Issue #49, dependências #21/#31/#32, Account Access PR #51.

## Decisão e escopo

O Syndes Platform Manager é aplicação exclusiva de governança da plataforma (Control Plane), com frontend separado na Tailnet HTTPS 9446. CRM, Inbox, Support, funcionários e equipes pertencem ao **Syndes Workspace**, utilizado tanto por clientes quanto pelo futuro tenant operacional da fornecedora Syndes.

Account Owner/Admin são papéis de **tenant/Control DB** da PR #51. Organization Admin é o membro ativo com papel técnico `platform_org_memberships.role='admin'`, mais OpenFGA. Workspace Manager/Supervisor é a designação de negócio explícita `supervisor` em um workspace, não um papel global. `agent` e `viewer` são designações operacionais; os papéis técnicos `admin/editor/viewer` continuam intocados. Cargo, equipe ou papel de Platform Owner **nunca** dão acesso a recursos por si só.

## Esquema aditivo não registrado em migração automática

O script manual `modules/organizations/sql/007_staff_roles_pre_release.sql` requer foundation Organization, CRM Employee e `crm_people.platform_organization_id` já existente e os **dois índices SQL 002 de contexto único**, sem os remover. Não cria usuários, novas empresas, segundo workspace, equipes fictícias ou permissões FGA.

- `platform_staff_identity_links`: vincula employee UUID de CRM a um principal do Keycloak, com FK por tenant, trigger validando funcionário ativo, empresa dona do contato, membership ativa, identidade imutável e revogação auditada; admite no máximo um vínculo ativo por employee ou principal por organização.
- `platform_workspace_staff_roles`: business roles `supervisor/agent/viewer`, com FK à membership técnica no mesmo tenant, organização e workspace. Supervisor/Agent exigem também role técnica `admin/editor`.
- `platform_staff_teams`, `platform_staff_team_workspaces` e `platform_staff_team_members`: estruturas por organização, relacionamentos explícitos por workspace e equipe, sem qualquer autorização automática por equipe.
- `platform_staff_access_audit`: eventos de identidade, designação e equipe, gerados na mesma transação e bloqueados contra alterações comuns. Superusuários PostgreSQL ainda podem alterar logs: para produção, exportação de auditoria para sistema independente.

## Backend, sem HTTP público

A classe `WorkforceService`, exportada do módulo Organizations, implementa `myProfile`, `bindEmployee`, `assignWorkspaceRole`, `revokeWorkspaceRole`, `createTeam` e `addTeamMember`. Exige no Core Kernel **membership de tenant e OpenFGA** no recurso `organizations:staff` antes de resolver banco, e funções mutáveis comprovam dentro do SQL que o ator possui papel de admin ativo na organização e no workspace solicitado. A consulta de perfil efetivo exige employee, pessoa CRM, vínculo Keycloak, organização, workspace e business role ativos em conjunto.

Não existe endpoint, tela, convite ou autorização de atendimento gerados por esse código. A migração não foi adicionada ao plugin por depender da ordem de CRM/Org e do Product Gate. Não usar diretamente em produção antes de revisar contratos públicos e auditoria.

## Testes

Unitários `modules/organizations/test/workforce.test.mjs` verificam negativa FGA antes do banco, escopo tenant, papel desconhecido e SQL parametrizado. A integração PostgreSQL `pg-workforce-roles.test.mjs` cria um **banco descartável** `syndes_wf_ci_*`, aplica schemas reais de Organization e CRM, coluna de owner de CRM produzida em produção pela migração separada, SQL 007 repetido duas vezes e fixtures A/B; testa associação, revogação, employee inativo, FGA, equipe, FK, auditoria e manutenção dos índices SQL 002.

Pendente para release: migração completa na ordem dos módulos em DB descartável, contratos HTTP com autenticação OIDC, FGA por ação/recurso, convite de funcionários, revisão de dados pessoais, gestão de equipes na UI e validação de autorização por fila no Support. A conta operacional da fornecedora ainda não foi provisionada.

## Preview visual independente

Frontend real do Manager: `https://delmacy-desktoppc.tayra-delta.ts.net:9446/`, somente Tailnet, imagem CI `syndes/master-admin-web:homolog-4138314`, contêiner `syndes-platform-manager-preview`, local `127.0.0.1:18085`. Rotas da API administrativa retornam 503 intencionalmente: **prévia visual não é console funcional**. Workspace em HTTPS 9443 e Keycloak em 9444 permanecem intactos. Não efetuar grant global sem identidade aprovada nem OpenBao AppRole.
