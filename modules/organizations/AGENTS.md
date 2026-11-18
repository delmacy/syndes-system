# Organizations / Units / Workspaces (Platform Core)

Scope: account = tenant/billing/physical DB boundary; organization = customer's company;
unit = physical branch/location; workspace = logical work context. Site is RESERVED
for future publishing (intranet/extranet/public portal).

Security:
- Authenticated actor + tenant membership + FGA check BEFORE tenant DB lookup.
- Org and Workspace membership checked for every read. Never infer from tenant alone.
- Authorized bootstrap creates only ONE default org/workspace and grants the first
  initializer; retry may never grant a new caller administrative membership.
- NO APIs for multiple organizations/workspaces until CRM/Inbox have org-scoped
  filtering across search, export and SSE.
- Additive migrations; no credential logs; org != crm_organizations.

## Contrato alvo aprovado (2026-11-18; ainda sem cutover)

- Um tenant (um database) contém N Platform Organizations; cada Organization contém N Workspaces. Cada Workspace contém N funis do Service v0.3.0 (ownership 1 workspace por funil), não um funil global compartilhado.
- Keycloak é único credential/identity engine e fonte de Organizations membership de identidade; SQL mantém memberships operacionais sem credenciais. OpenFGA apenas concede relação por recurso, não autentica nem mantém contas.
- A arquitetura é **alvo**; índices SQL002 **continuam bloqueando** organizações/workspaces adicionais até auditoria cross-org de CRM, Inbox, WhatsApp, SSE, Service e fences IAM, testes A/B e restore/rollback em staging.
- O modelo Service atual usa FK composta para funnel; NÃO criar uma tabela N:N workspace_funnels por interpretação de ADR antiga. Ver `docs/engineering/ADR-IAM-IDENTITY-AUTHORITY-MULTIORG-20261118.md`.
