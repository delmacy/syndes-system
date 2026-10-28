# CRM-11 — Revisão integrada e gate de aceite

- **Módulo/gate:** Core CRM integrated acceptance / Sprint 4.
- **Classificação:** MVP.
- **Prioridade/estado:** P0 final / **ACEITO** em 2026-10-28 após revisão da jornada autenticada e dos checks do commit `9c0707c`.
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

## Evidência revisada (2026-10-28)

- API: lint, typecheck, build; Jest com PostgreSQL: 32 suites/193 testes aprovados.
- Provisioning: migrations aplicadas do zero e reaplicadas como no-op; role tenant sem privilégios de criação e sem conexão cruzada entre databases.
- Web: lint, typecheck, build; Vitest: 8 arquivos/17 testes aprovados.
- `npm audit --audit-level=high`: zero vulnerabilidades em API e web.
- Playwright headless: workflow [CRM Acceptance run 40636689299](https://github.com/delmacy/syndes-system/actions/runs/40636689299) passou em 1m39s, no commit `9c0707c6063d3840c5ede303818fb26227880686`. Resultado: `expected=1`, `skipped=0`, `unexpected=0`, `flaky=0`; seis etapas aprovadas: login/contexto do tenant, criação de Organization, Person/Relationship, Tag/Note, busca/Timeline, Archive/CSV export. JSON e logs dos serviços foram baixados e revisados.
- Logs revisados: API registrou apenas resolução de identidade e contexto (`tenant_admin`, `both`, host local), sem tokens/segredos ou dados CRM; Next iniciou normalmente. Keycloak importou o realm descartável e emitiu aviso de configuração depreciada `Full scope allowed` no client de teste; sem falha na autenticação/jornada e sem impacto no código de produção.
- GitHub Actions no mesmo commit: API run [40636689297](https://github.com/delmacy/syndes-system/actions/runs/40636689297) passou com lint, typecheck, unit, integration em PostgreSQL 16, build, audit e verificação das migrations/provisioning; Web CI passou com lint, typecheck, Vitest, build e audit; Repository Integrity run [40636689309](https://github.com/delmacy/syndes-system/actions/runs/40636689309) passou.
- Testes de integração existentes cobrem isolamento entre databases e tentativas cross-tenant em CRUD/CSV; esses testes passaram no job API acima.

## Excluído

- Abrir PR, merge, release, publicar/deploy, performance RC stress/soak (gate de Release Candidate, posterior ao módulo).
- Aceitar bloqueio de segurança por compensação em documentação.

## Critérios de aceite e saída

- Matriz requisito → arquivo/capability → teste → evidência sem lacunas de segurança.
- CI do commit revisado verde; migrations testadas em PostgreSQL descartável.
- Zero cross-tenant disclosure e unauthorized access em testes; manager sem acesso implícito a CRM.
- Regras de DoD global cumpridas e jornada demonstrável.
- **Decisão formal: ACEITO.** Evidências acima atendem os critérios de integração, testes, isolamento e jornada demonstrável. O Product Gate do Core CRM está concluído; Inbox fica elegível para a próxima fase conforme a ordem global, sem implementação iniciada por esta aceitação.
