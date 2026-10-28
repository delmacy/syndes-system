# CRM-11 — Revisão integrada e gate de aceite

- **Módulo/gate:** Core CRM integrated acceptance / Sprint 4.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 final / BLOQUEADO até a execução e revisão da jornada autenticada no workflow manual `CRM Acceptance`.
- **Responsável:** Codex coordena e aceita; agentes implementadores só recebem correções novas, delimitadas e sequenciais.
- **Issue/branch/commit/PR:** ainda não criados; esta é uma ordem local, sem operação externa.

## Objetivo e escopo

Consolidar evidência de requisitos, integração, segurança, testes e prontidão demonstrável. Não substituir evidência de teste por relatório do agente ou CI verde.

## Incluído

- Mapear cada requisito da spec a implementação, teste/evidência e owner.
- Revisar API/UI contracts, module boundaries, migration history, errors, audit/logging, Git hygiene e security review.
- Verificar testes unit/component/integration/contract e workflows CI configurados.
- Confirmar testes cross-tenant, authz, provisioning idempotency, manager data boundary e CSV safety.
- Prove `cpf`, `pj`, and `both` scopes across CRUD, linked contacts, search, timeline, and import; prove `tenant_admin` can change a member's scope and the change is audited.
- Preparar jornada demonstrável. E2E frontend fica registrado como necessário/pendente ou executa-se somente sob instrução/gate explícito via Playwright headless, lendo logs/resultados.

## Evidência local (atualizada em 2026-10-28)

- API: lint, typecheck, build; Jest com PostgreSQL: 32 suites/193 testes aprovados.
- Provisioning: migrations aplicadas do zero e reaplicadas como no-op; role tenant sem privilégios de criação e sem conexão cruzada entre databases.
- Web: lint, typecheck, build; Vitest: 8 arquivos/17 testes aprovados.
- `npm audit --audit-level=high`: zero vulnerabilidades em API e web.
- Playwright: jornada headless existente; workflow manual `CRM Acceptance` preparado para importar realm Keycloak descartável, provisionar tenant real em PostgreSQL e guardar JSON/logs. Execução ainda pendente.
- GitHub Actions do commit `5a935f0`: API run [40630437451](https://github.com/delmacy/syndes-system/actions/runs/40630437451) passou, incluindo PostgreSQL 16, migrations, provisioning e o job Web; Repository Integrity run [40630437336](https://github.com/delmacy/syndes-system/actions/runs/40630437336) passou. O teardown dos bancos de integração agora espera o encerramento das conexões e não usa `DROP DATABASE ... WITH (FORCE)`.
- Ainda pendente: executar o workflow manual e revisar o JSON Playwright e logs dos serviços. O harness é exclusivo do workflow opt-in, usa credenciais sintéticas e overrides de teste em memória; até haver output Playwright aprovado, a decisão formal deste gate permanece `BLOQUEADO` e não se declara `ACEITO`.

## Excluído

- Abrir PR, merge, release, publicar/deploy, performance RC stress/soak (gate de Release Candidate, posterior ao módulo).
- Aceitar bloqueio de segurança por compensação em documentação.

## Critérios de aceite e saída

- Matriz requisito → arquivo/capability → teste → evidência sem lacunas de segurança.
- CI do commit revisado verde; migrations testadas em PostgreSQL descartável.
- Zero cross-tenant disclosure e unauthorized access em testes; manager sem acesso implícito a CRM.
- Regras de DoD global cumpridas e jornada demonstrável.
- Decisão formal `ACEITO`, `CORREÇÕES NECESSÁRIAS` ou `BLOQUEADO`, com evidência e próximo responsável. Estado atual: `BLOQUEADO` até a execução e revisão do workflow manual; próximo responsável é Codex, que deve iniciar a execução, analisar os artefatos e corrigir falhas do harness ou da jornada.
- Próximo módulo (Inbox) só fica liberado após `ACEITO` no Core CRM.
