# PRD-001 Task Orders

Estas ordens são ordens locais derivadas de `docs/product/PRD-001-CORE-CRM-SPEC.md` e `docs/engineering/PRD-001-CORE-CRM-SPRINT-PLAN.md`. Não são GitHub Issues. O CRM-01 foi despachado via Orca; as demais implementações aguardam os gates/dependências abaixo.

## Ordem e estado

| ID | Sprint | Responsável recomendado | Estado/dependência |
|---|---|---|---|
| CRM-00 | 0 | Codex | ACEITA; Gate 0 concluído no commit `075e329` |
| CRM-01 | 0 | OpenCode Free (backend/review) | ACEITA; API e Repository Integrity CI verdes, incluindo PostgreSQL 16 |
| CRM-02 | 1 | OpenCode Free; Codex revisa | ACEITA em `8c57126`; API e Repository Integrity CI verdes, com integração PostgreSQL 16 |
| CRM-03 | 1 | OpenCode Free | Depende CRM-00 e CRM-02 |
| CRM-04 | 1 | OpenCode Free | Depende CRM-03 |
| CRM-05 | 2 | OpenCode Free | Depende CRM-03 e CRM-04 |
| CRM-06 | 2 | OpenCode Free | Depende CRM-05 |
| CRM-07 | 2 | OpenCode Free | Depende CRM-05 e CRM-06 |
| CRM-08 | 2 | OpenCode Free | Depende CRM-05 e CRM-03 |
| CRM-09 | 3 | Cursor Auto | Depende CRM-04 e contratos/sessão; UI manager |
| CRM-10 | 3 | Cursor Auto | Depende CRM-05 a CRM-08 e API/session contracts |
| CRM-11 | 4 | Codex coordena; agentes corrigem por ordem nova | Depende das ordens anteriores |

## Decisões confirmadas pelo usuário

- Keycloak como serviço OIDC, com SSO do realm no MVP; federação SAML/OIDC específica por tenant fica pós-MVP.
- MFA obrigatória para Platform Admin; membros seguem política operacional configurável do realm Keycloak.
- Papéis separados: `tenant_admin` pode executar todas as operações aprovadas; `tenant_member` pode ler/criar/editar, mas não arquivar nem exportar.
- Employee é perfil opcionalmente vinculado a uma conta; atendentes usam a mesma tela. `tenant_admin` configura `cpf`/`pj`/`both`; PJ inclui Persons de contato da Organization, CPF inclui Persons sem vínculo PJ.
- NestJS, Next.js App Router, Drizzle ORM e PostgreSQL; Control Plane separado e um database por tenant.

## Execução Orca

- Run: `run_e16dc258e959` (aberto em 2026-10-27; sem issues/PRs criadas; CI executado no push do branch).
- CRM-01: task `task_465e1a68981a`; implementação e revisões corretivas concluídas no modelo OpenCode `glm-5.3-flash-free`. Evidência final no commit `075e329`: API run `40507834957` e Repository Integrity run `40507834659` passaram; workflow API aplicou e verificou migrations em PostgreSQL 16 descartável.
- CRM-00: contratos de identidade/autorização, Employee/customer scope e runbook de membership foram registrados e cross-reviewados; nenhum endpoint/UI foi iniciado.
- Sprint 0/Gate 0 ACEITO. CRM-02 foi revisada, corrigida e ACEITA no commit `8c57126`. API CI `40524011187` e Repository Integrity `40524011177` passaram; API CI executou testes de provisioning e verificação de migrations em PostgreSQL 16 descartável. Próximo: CRM-03.

## Regras de dispatch

- Só um agente mutável por vez; nunca iniciar duas ordens de escrita concorrentes.
- O responsável recomendado é uma sugestão de harness, não transferência de autoridade: Codex revisa e aceita cada ordem.
- O agente recebe esta ordem, `AGENTS.md` aplicável, spec, sprint e apenas os contratos necessários.
- PR/issue/branch/GitHub Actions não são criados por estas ordens; registrar localmente evidência e aguardar instrução antes de operações externas.
- Cada ordem deve reportar diff/arquivos, comandos e resultados, migrations/DB, riscos e próximo owner. Não executar E2E frontend salvo solicitação/necessidade de gate; quando executado, usar Playwright headless e analisar logs/resultados.

## Ordens

- [CRM-00 — Fechar Product Gate e contratos](CRM-00-gate-contracts.md)
- [CRM-01 — Revisar registry/migration e prova CI](CRM-01-control-plane-registry.md)
- [CRM-02 — Provisionamento idempotente](CRM-02-provisioning.md)
- [CRM-03 — Identidade, authorization, tenant routing e audit](CRM-03-identity-tenant-context.md)
- [CRM-04 — API manager de tenants](CRM-04-platform-admin-api.md)
- [CRM-05 — Schema CRM e Organizations/People/Relationships](CRM-05-crm-core-api.md)
- [CRM-06 — Tags, Notes, Timeline, Archive e ChannelIdentity](CRM-06-crm-supporting-features.md)
- [CRM-07 — Busca, normalização e duplicidade](CRM-07-search-normalization.md)
- [CRM-08 — CSV import/export](CRM-08-csv.md)
- [CRM-09 — Frontend Platform Admin](CRM-09-platform-admin-ui.md)
- [CRM-10 — Frontend Core CRM](CRM-10-core-crm-ui.md)
- [CRM-11 — Revisão integrada e gate de aceite](CRM-11-acceptance.md)
