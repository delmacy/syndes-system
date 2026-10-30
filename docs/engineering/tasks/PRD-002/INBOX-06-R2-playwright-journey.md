# INBOX-06-R2 — Jornada Inbox Playwright headless

- **Classificação:** `BLOCKER` de evidência do Product Gate
- **Owner executor:** OpenCode2 NVIDIA-only
- **Owner de aceite:** coordenação/Codex
- **Ownership:** `apps/web/tests/acceptance/inbox.acceptance.spec.ts` e artefatos em `docs/engineering/tasks/PRD-002/artifacts/inbox-playwright/`

## Objetivo

Criar um script Playwright headless reproduzível para a jornada fake inbound → fila → assignment → resposta pública → nota privada → status → anexo → reconnect/refetch.

## Restrições

- Usar seed/tenant descartável e teardown seguro; nenhum tenant do usuário.
- Não guardar tokens em arquivos; mascarar secrets nos logs.
- Não conectar WhatsApp/email reais e não alterar autenticação global.
- E2E é opt-in: não adicionar ao CI rápido sem decisão da coordenação.
- Não fazer commit/push ou autoaceite.

## Execução realizada

### Comandos executados (apps/web)

- Lint do arquivo tocado: `npx eslint tests/acceptance/inbox.acceptance.spec.ts` → **verde** (sem erros).
- Typecheck do pacote: `npx tsc --noEmit` → **verde** (sem erros).
- Execução E2E (`E2E_BASE_URL=http://localhost:3000 npx playwright test --config=playwright.acceptance.config.ts`): **executada, falhou em ambiente**.
  - Next.js iniciado com sucesso em `http://localhost:3000` (`.env.local` carregado).
  - Playwright executou o spec `inbox.acceptance.spec.ts`.
  - Falha no passo `login_and_tenant_context`: `SSO credentials are required when no session exists.` — nenhum IdP Keycloak em execução e `E2E_KEYCLOAK_USERNAME`/`E2E_KEYCLOAK_PASSWORD` não definidos.
  - Mesmo com credenciais, não há backend API na porta 3001 (não inicia: `KEYCLOAK_ISSUER` obrigatório + PostgreSQL indisponível na porta 54331).

### Arquivos criados/alterados

1. `apps/web/tests/acceptance/inbox.acceptance.spec.ts` — script headless com as etapas:
   - `login_and_tenant_context`
   - `queue_visible`
   - `open_conversation`
   - `assign_conversation`
   - `send_reply`
   - `save_private_note`
   - `change_status`
   - `upload_attachment`
   - `reconnect_refresh`
   Emite JSON estruturado por etapa (`inbox-acceptance-step`) e anexa `inbox-acceptance-steps.json` ao final. Credenciais nunca aparecem em logs/JSON.
2. `apps/web/scripts/seed-inbox-disposable.mjs` — seed idempotente de tenant + conversa fake sintética (IDs fixos, sem dados reais). Requer `TENANT_DATABASE_URL`.
3. `apps/web/scripts/teardown-inbox-disposable.mjs` — remove apenas registros sintéticos criados pelo seed. Idempotente.
4. `apps/web/scripts/run-inbox-acceptance.ps1` — orquestração: seed → Playwright headless → teardown.
5. `apps/web/.env.local` — variáveis sintéticas locais para Next.js (gitignorado via `.env*`). Não contém secrets reais.
6. `docs/engineering/tasks/PRD-002/artifacts/inbox-playwright/PREREQUISITES.md` — pré-requisitos, comando, limitações e bloqueios de ambiente exatos.
7. `docs/engineering/tasks/PRD-002/INBOX-06-R2-playwright-journey.md` — este documento (atualizado com evidência).

## Aceite

| Critério | Status |
|---|---|
| Script headless executa ou falha com diagnóstico determinístico | Implementado; executado com diagnóstico determinístico (falha em `login_and_tenant_context` por ausência de IdP Keycloak) |
| JSON/log por etapa, sem tokens/secrets | Implementado |
| Cobre admin/member, nota privada separada, erro de entrega e recuperação após reconnect | Implementado no script (erro de delivery coberto pelo contrato do frontend; reconnect por recarga + evento online) |
| Documenta pré-requisitos, comando e limitações | Implementado (`PREREQUISITES.md`) |
| Scripts de seed/teardown para tenant fake sintético | Implementados (`seed-inbox-disposable.mjs`, `teardown-inbox-disposable.mjs`) |

## Bloqueios / gaps residuais

| # | Bloqueio | Detalhe exato |
|---|----------|---------------|
| B1 | PostgreSQL indisponível | `CONTROL_PLANE_DATABASE_URL` aponta para `127.0.0.1:54331` → `ECONNREFUSED`. Porta `5433` recusa credencial (`password authentication failed for user "api_ci"`). Docker, `psql` e `pg_isready` não estão no PATH. Não é possível provisionar banco de tenant descartável. |
| B2 | API backend não inicia | `nest start` falha: `KEYCLOAK_ISSUER` é obrigatório e não está configurado no `.env` da API. Mesmo que estivesse, a API depende do Control Plane PostgreSQL (bloqueio B1). |
| B3 | Keycloak/IdP indisponível | Nenhum IdP Keycloak em execução. O passo `login_and_tenant_context` falha com `SSO credentials are required when no session exists.` mesmo com `E2E_BASE_URL` definido. Sem credenciais SSO e sem IdP, o login não pode ser executado. |
| B4 | Nenhum tenant descartável provisionado | Sem banco (B1) e sem API (B2), não é possível criar tenant nem persistir conversa fake inbound via adapter determinístico. |

- **Execução E2E bloqueada por ausência de ambiente:** sem PostgreSQL, API e Keycloak, o script não pode completar a jornada para gerar JSON/logs reais.
- O passo `open_conversation` falha com diagnóstico determinístico ("fila vazia") se não houver conversa na fila.
- Reconnect é simulado por recarga de página + evento `online`; o estado é recuperado pela API, não por buffer realtime.
- E2E permanece opt-in; somente rodar pelo fluxo headless com artefatos, sob gate da coordenação.

## Pré-requisitos para execução

Ver `docs/engineering/tasks/PRD-002/artifacts/inbox-playwright/PREREQUISITES.md`.

## Próximo passo

Resolver B1 (PostgreSQL na porta 54331 com credencial válida) e B3 (Keycloak/IdP com `KEYCLOAK_ISSUER` configurado) para habilitar provisionamento de tenant descartável e execução da jornada completa. Sem esses serviços, o máximo executável é o diagnóstico determinístico já produzido pelo script. A coordenação/Codex deve liberar gate de execução com `E2E_BASE_URL`, credenciais SSO de tenant descartável e tenant com conversa na fila.
