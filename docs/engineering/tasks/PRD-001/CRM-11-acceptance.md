# CRM-11 — Revisão integrada e gate de aceite

- **Módulo/gate:** Core CRM integrated acceptance / Sprint 4.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 final / em validação integrada; gates locais aprovados, CI remoto e demonstração autenticada ainda pendentes.
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

## Evidência local (2026-10-27)

- API: lint, typecheck, build; Jest com PostgreSQL: 32 suites/193 testes aprovados.
- Provisioning: migrations aplicadas do zero e reaplicadas como no-op; role tenant sem privilégios de criação e sem conexão cruzada entre databases.
- Web: lint, typecheck, build; Vitest: 8 arquivos/17 testes aprovados.
- `npm audit --audit-level=high`: zero vulnerabilidades em API e web.
- Playwright: a jornada existe e aparece em `--list`; execução opt-in não realizada.
- Ainda pendente: CI do commit e execução/demonstração da jornada autenticada em ambiente com Keycloak e tenant provisionado.

## Excluído

- Abrir PR, merge, release, publicar/deploy, performance RC stress/soak (gate de Release Candidate, posterior ao módulo).
- Aceitar bloqueio de segurança por compensação em documentação.

## Critérios de aceite e saída

- Matriz requisito → arquivo/capability → teste → evidência sem lacunas de segurança.
- CI do commit revisado verde; migrations testadas em PostgreSQL descartável.
- Zero cross-tenant disclosure e unauthorized access em testes; manager sem acesso implícito a CRM.
- Regras de DoD global cumpridas e jornada demonstrável.
- Decisão formal `ACEITO`, `CORREÇÕES NECESSÁRIAS` ou `BLOQUEADO`, com evidência e próximo responsável. Estado atual: validação pendente; não declarar `ACEITO` antes de CI verde e demonstração do fluxo.
- Próximo módulo (Inbox) só fica liberado após `ACEITO` no Core CRM.
