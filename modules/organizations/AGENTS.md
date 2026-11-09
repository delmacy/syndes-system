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
