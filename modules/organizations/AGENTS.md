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

## Contrato transversal de módulos, schemas e metering (2026-11-10)

- Módulo possui schema PostgreSQL próprio nomeado pelo ID curto, após a fase de migração aprovada. Nenhum módulo controla schemas/tabelas de outros ou altera o Control DB por acesso direto. Integração entre módulos ocorre por API/contrato/eventos ou views de leitura aprovadas com dependências declaradas.
- Acesso depende de identidade Keycloak, membership tenant/org/workspace quando aplicável, habilitação no catálogo do Control Plane e OpenFGA; não utilizar `tenant_id` enviado pelo browser como autoridade. Desativar módulo não apaga dados. Migrações apenas por instalador aprovado e testes PG17 descartáveis.
- Se houver medição de uso necessária, declarar a métrica e sua fonte com idempotência; não atribuir preço, cobrar por retries nem implementar Billing/Payments dentro do domínio. O PRD-009 de Subscription & Billing continua posterior ao núcleo operacional.
- Consultar `AGENTS.md` da raiz, `docs/engineering/BILLING-METERING-FOUNDATION-20261110.md` e WBS/ADR da PR #65; não declarar schema migrado antes de comprovação SQL/Host/testes.