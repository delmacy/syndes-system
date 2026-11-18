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

### IAM-TOPO-03B — instalador alternativo do fence (2026-11-18)

- `008_iam07d_revoke_first_candidate.sql` permanece imutável e exige SQL002. Para um banco já migrado por cutover operador-only existe `009_iam_multiorg_fence_candidate.sql`, **alternativa manual/CI**, que exige os dois índices SQL002 AUSENTES e FKs reais dos memberships Org/Workspace.
- Nunca instalar 009 em tenant legado nem remover os índices como efeito colateral desse instalador; a retirada precisa de gate separado, rollback/restore e Host comprovadamente org-scoped.
- A suíte PG17 descartável testa 009 negando quando ambos ou um índice SQL002 ainda existe, aceitando quando ambos ausentes, mantendo fence/outbox e revertendo tudo; não confundir esta prova com autorização para executar em produção.
