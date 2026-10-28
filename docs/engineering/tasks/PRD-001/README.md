# PRD-001 Task Orders

Estas ordens são ordens locais derivadas de `docs/product/PRD-001-CORE-CRM-SPEC.md` e `docs/engineering/PRD-001-CORE-CRM-SPRINT-PLAN.md`. Não são GitHub Issues. O CRM-01 foi despachado via Orca; as demais implementações aguardam os gates/dependências abaixo.

## Ordem e estado

| ID | Sprint | Responsável recomendado | Estado/dependência |
|---|---|---|---|
| CRM-00 | 0 | Codex | ACEITA; Gate 0 concluído no commit `075e329` |
| CRM-01 | 0 | OpenCode Free (backend/review) | ACEITA; API e Repository Integrity CI verdes, incluindo PostgreSQL 16 |
| CRM-02 | 1 | OpenCode Free; Codex revisa | ACEITA em `8c57126`; API e Repository Integrity CI verdes, com integração PostgreSQL 16 |
| CRM-03 | 1 | OpenCode Free; Codex revisa | ACEITA em `300017f`; API, web e Repository Integrity CI verdes |
| CRM-04 | 1 | OpenCode Free; Codex revisa | ACEITA em `8b41a11`; PostgreSQL 16 integration (15 tests), API/web CI e Repository Integrity verdes |
| CRM-05 | 2 | OpenCode Free; Codex revisa | ACEITA; API CI verde em PostgreSQL 16 no commit `5a935f0` |
| CRM-06 | 2 | Codex (review/correções) + OpenCode Free (auditoria supervisionada) | ACEITA; testes unitários e integração PostgreSQL 17 locais passaram; API CI verde em PostgreSQL 16 no commit `5a935f0` |
| CRM-07 | 2 | Codex (revisão e correção após worker free falhar) | ACEITA; busca, normalização, duplicidade, escopo CPF/PJ/BOTH e isolamento A/B passaram localmente; API CI verde em PostgreSQL 16 no commit `5a935f0` |
| CRM-08 | 2 | OpenCode Free corretivo; Codex revisa | ACEITA; testes unitários e integração PostgreSQL 17, lint, typecheck, build e audit local passaram; API CI verde em PostgreSQL 16 no commit `5a935f0` |
| CRM-09 | 3 | Codex (após tentativas free sem worker confiável) | Validada localmente; Platform Admin UI e 3 testes de componente; CI remoto no gate final |
| CRM-10 | 3 | Codex (execução direta; suporte API mínimo incluído) | Validada localmente; CRM UI e 3 testes de componente; CI remoto no gate final |
| CRM-11 | 4 | Codex | Implementação e CI aceitas; gate final BLOQUEADO até demonstrar a jornada autenticada com Keycloak e tenant descartável |

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
- Sprint 0/Gate 0 ACEITO. CRM-02 foi revisada, corrigida e ACEITA no commit `8c57126`; CRM-03 e CRM-04 completam e ACEITAM a Sprint 1. Provas finais: API CI `40546566664` (inclui PostgreSQL 16, 122 unit tests, 15 integration tests, migrations/provisioning); Repository Integrity `40546566483`; web CI no mesmo workflow — todos passaram. Próxima ordem: CRM-05 na Sprint 2.
- CRM-05 foi ACEITA por Codex após review e correção do PATCH em Person arquivada. O teste PostgreSQL confirmou HTTP 409 e preservação dos campos; correção com 29 integration tests/4 suites, 138 unit tests/23 suites, typecheck e lint verdes. CI de Sprint 2 ainda pendente.
- CRM-06 foi retomada e ACEITA localmente por Codex após escolha do usuário. Tags, Notes, Timeline, ChannelIdentity, eventos transacionais append-only e escopos foram revisados; validações verdes: lint, typecheck, build, 24 suites/141 unit tests, 4 suites/31 PostgreSQL integration tests com `--detectOpenHandles`, aplicação da migration do zero e sobre o CRM-05 e `tenant:verify:provisioning`. Não houve commit nem CI Sprint 2. Quatro tentativas anteriores do worker free estão encerradas/liberadas; Orca marcou o task como `failed` após o limite de tentativas, então nenhuma nova dispatch será criada para contornar o circuit breaker.
- CRM-06 revisão corretiva (2026-10-28): OpenCode NVIDIA Free fez auditoria supervisionada no dispatch `ctx_8310386c3752`; Codex aceitou após conferir o diff. A correção move a auditoria de `Person.update/archive` para fora da transação tenant, preservando evento da timeline dentro dela. Foram adicionados cinco testes PostgreSQL (eventos de apoio, falha sem gravação, isolamento A/B, atualização de metadados sem sobrescrever nome CRM, cronologia) e oito testes unitários de schema/event kinds. OpenCode reportou 29 suites/162 unit tests, 2 suites/29 PostgreSQL integration tests em cluster PostgreSQL 17 descartável (incluindo migração em banco vazio, reaplicação idempotente e CRM-05 baseline), lint/typecheck/build verdes; Codex repetiu unitários 29/162, lint, typecheck e build verdes. Cluster descartável removido. CI Sprint 2 ainda pendente para o commit com esta correção.
- CRM-07 foi revisada e corrigida diretamente após workers free falharem. Validação PostgreSQL confirmou busca por campos aprovados, normalização, paginação, duplicidade explicável, escopo CPF/PJ/BOTH e isolamento entre databases; suites combinadas de persistência passaram. Codex ainda deve registrar evidência final e CI do Sprint 2.
- CRM-08 implementa import/export CSV para Person e Organization, UTF-8/BOM, parser RFC 4180, limites, cabeçalhos aprovados, validação integral, transação all-or-nothing, escopo, erros sem PII, exportação admin-only, neutralização de fórmulas e audit/timeline. A integração PostgreSQL da fatia passou com 21 testes; a suite API completa do gate local passou com 32 suites/193 testes.
- CRM-08 revisão corretiva (2026-10-28): OpenCode Free implementou preservação de bytes com `express.raw`, UTF-8 fatal aceitando U+FFFD válido, rejeição de bytes inválidos, resposta exata `413/csv_too_large` sem escrita e tratamento de células opcionais vazias. Codex revisou o diff; 32 suites/180 testes unitários passaram após `npm ci`, integração PostgreSQL 17 descartável reportada em 4 suites/52 testes e repetida independentemente em 1 suite/34 testes, lint/typecheck/build passaram e `npm audit` encontrou zero vulnerabilidades. O cluster descartável foi removido. CI do Sprint 2 ainda pendente.
- CRM-09 implementou Platform Admin UI consumindo o BFF autenticado, sem segredos nem conteúdo tenant; list/create/detail/metadata update/provision retry/initial-admin assignment. Os 3 testes de componente passaram.
- CRM-10 implementou busca, cadastros, edição/arquivo, relacionamentos, tags, notas, timeline, identidades de canal, CSV e configurações de equipe. Foi adicionada API mínima para contexto autenticado, consulta/atualização de memberships e lista de vínculos visíveis. Web: lint/typecheck/build e Vitest (8 arquivos/17 testes) passaram.
- Gate local integrado (2026-10-27): API lint/typecheck/build e Jest com PostgreSQL (32 suites/193 testes) passaram; `tenant:verify:provisioning` passou, incluindo migrations do zero, idempotência e negação de conexão entre tenants. Web lint/typecheck, Vitest (8 arquivos/17 testes), Next build e `npm audit` das duas aplicações passaram; ambos reportaram zero vulnerabilidades. Playwright acceptance foi listado sem executar a jornada, conforme política opt-in.
- CI remoto do commit `93eeda6`: API run `40586765411` e Repository Integrity run `40586765265` verdes; CI Web incluído no job da API também verde. CRM-11 registrou `BLOQUEADO` somente para a demonstração autenticada em ambiente Keycloak/tenant de teste, indisponível neste checkout. O script Playwright está pronto/listável e permanece opt-in.
- Correção do teardown PostgreSQL (2026-10-28): commit `5a935f0` aguarda o encerramento das conexões dos pools antes de remover databases de teste, sem `DROP DATABASE ... WITH (FORCE)`. A API run `40630437451` passou incluindo integração em PostgreSQL 16 e verificação de migrations/provisioning; Repository Integrity run `40630437336` passou. Com isso, o gate de CI da Sprint 2 está ACEITO. CRM-11 permanece bloqueado apenas pela jornada autenticada com Keycloak e tenant de teste.
- CRM-11 assessment read-only via OpenCode/NVIDIA (2026-10-28): script Playwright já está headless e produz JSON/logs; não existe semeadura de realm/usuário Keycloak. O worker usou efetivamente `nvidia/nemotron-3.5-lightning-30b-a3b`, não alterou arquivos nem iniciou serviços. A trava restante é preparar um realm e usuário de teste junto de um tenant provisionado e executar/analisar a jornada.

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
