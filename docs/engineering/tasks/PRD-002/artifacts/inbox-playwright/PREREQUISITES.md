# INBOX-06-R2 — Pré-requisitos, comando e limitações

## Objetivo

Script Playwright headless, opt-in, reproduzindo a jornada Inbox:
`fake inbound → fila → assignment → resposta pública → nota privada → status → anexo → reconnect/refetch`.

## Propriedade exclusiva

- `apps/web/tests/acceptance/inbox.acceptance.spec.ts`
- `apps/web/scripts/seed-inbox-disposable.mjs`
- `apps/web/scripts/teardown-inbox-disposable.mjs`
- `apps/web/scripts/run-inbox-acceptance.ps1`
- `docs/engineering/tasks/PRD-002/artifacts/inbox-playwright/`
- `docs/engineering/tasks/PRD-002/INBOX-06-R2-playwright-journey.md`

## Pré-requisitos

1. **Variável `E2E_BASE_URL`** definida apontando para um host de tenant autorizado
   (ex.: `http://localhost:3000` ou host de staging do tenant descartável).
2. **Credenciais SSO do tenant descartável** em variáveis de ambiente (nunca commitadas):
   - `E2E_KEYCLOAK_USERNAME`
   - `E2E_KEYCLOAK_PASSWORD`
   - `E2E_KEYCLOAK_OTP` (somente quando o IdP solicitar MFA)
3. **Servidor Next.js da web** em execução e acessível em `E2E_BASE_URL`:
   - Iniciar com `npx next dev --port 3000` a partir de `apps/web` (env `.env.local` já configurado).
4. **API backend** acessível em `SYNDES_API_URL` (padrão `http://localhost:3001`):
   - Requer PostgreSQL disponível e `KEYCLOAK_ISSUER` configurado.
5. **Banco de tenant descartável** populado com pelo menos uma conversa na fila:
   - Executar `node scripts/seed-inbox-disposable.mjs` (define `TENANT_DATABASE_URL`).
   - O seed cria registros sintéticos com IDs fixos conhecidos (não dados reais).
6. **Browsers do Playwright** instalados (cache `ms-playwright` presente).
7. **Execução somente quando houver gate explícito da coordenação**; E2E é opt-in e não entra no CI rápido.

## Comando

Execução a partir de `apps/web`:

```powershell
$env:TENANT_DATABASE_URL="<tenant-db-url>"
$env:E2E_BASE_URL="http://localhost:3000"
$env:E2E_KEYCLOAK_USERNAME="<usuario>"
$env:E2E_KEYCLOAK_PASSWORD="<senha>"
$env:E2E_KEYCLOAK_OTP="<otp-opcional>"

# 1. Seed do tenant/conversa fake sintético
node scripts/seed-inbox-disposable.mjs

# 2. Jornada Playwright headless
./scripts/run-inbox-acceptance.ps1

# 3. Teardown automático é executado pelo script de orquestração
```

Resultado JSON em `playwright-results/results.json`; artefatos (traces/screenshots em falha) em `playwright-results/artifacts/`; o spec também emite JSON estruturado por etapa no console e anexa `inbox-acceptance-steps.json`.

## Scripts incluídos

| Script | Propriedade |
|--------|-------------|
| `apps/web/scripts/seed-inbox-disposable.mjs` | Seed idempotente de tenant + conversa fake sintética (IDs fixos, sem dados reais). Requer `TENANT_DATABASE_URL`. |
| `apps/web/scripts/teardown-inbox-disposable.mjs` | Remove apenas os registros sintéticos criados pelo seed. Idempotente. |
| `apps/web/scripts/run-inbox-acceptance.ps1` | Orquestração: seed → Playwright headless → teardown. |

## Restrições de segurança e dados

- Não usar dados reais nem providers WhatsApp/e-mail reais.
- Não alterar auth global nem API.
- Não guardar tokens em arquivos; mascarar secrets nos logs (credenciais nunca aparecem em JSON/console salvo).
- Seed/tenant descartável com teardown seguro; nenhum tenant do usuário de produção.
- Não fazer commit, push, merge ou autoaceite.

## Limitações documentadas

- A jornada depende de uma conversa já existente na fila (fake inbound previamente persistida pelo adapter determinístico ou via seed).
- Se não houver conversa na fila, o passo `open_conversation` falha com diagnóstico determinístico ("fila vazia").
- Reconnect é simulado por recarga de página + evento `online`; não depende de buffer realtime para recuperar estado (estado vem da API).
- Nota privada é verificada separadamente da resposta pública (marcador "Nota privada", endpoint `/notes` isolado do outbound).
- Erro de entrega: o script cobre falha de envio e mantém o rascunho (conforme contrato do frontend).
- Execução opt-in: não adicionar ao CI rápido sem decisão da coordenação.

## Artefatos esperados por etapa

Cada etapa emite `{"type":"inbox-acceptance-step","step":...,"status":...,"elapsedMs":...}` e o resumo final emite `{"type":"inbox-acceptance-summary","journey":"inbox","steps":[...]}`.

## Bloqueios de ambiente verificados nesta execução (2026-10-29)

| # | Bloqueio | Detalhe exato |
|---|----------|---------------|
| B1 | PostgreSQL indisponível | `CONTROL_PLANE_DATABASE_URL` aponta para `127.0.0.1:54331` → `ECONNREFUSED`. Porta `5433` recusa credencial (`password authentication failed for user "api_ci"`). Docker, `psql` e `pg_isready` não estão no PATH. Não é possível provisionar banco de tenant descartável. |
| B2 | API backend não inicia | `nest start` falha: `KEYCLOAK_ISSUER` é obrigatório e não está configurado no `.env` da API. Mesmo que estivesse, a API depende do Control Plane PostgreSQL (bloqueio B1). |
| B3 | Keycloak/IdP indisponível | Nenhum IdP Keycloak em execução. O passo `login_and_tenant_context` falha com `SSO credentials are required when no session exists.` mesmo com `E2E_BASE_URL` definido. Sem credenciais SSO e sem IdP, o login não pode ser executado. |
| B4 | Nenhum tenant descartável provisionado | Sem banco (B1) e sem API (B2), não é possível criar tenant nem persistir conversa fake inbound via adapter determinístico. |

Consequência: o script Playwright executa e emite JSON/log por etapa, mas a jornada completa (fake inbound → fila → … → reconnect) **não pode ser executada até que B1–B4 sejam resolvidos**. A execução local disponível produz diagnóstico determinístico em cada etapa falhada.

## Próximo passo

Resolver B1 (PostgreSQL) e B3 (Keycloak/IdP) para habilitar provisionamento de tenant descartável e execução da jornada completa. Sem esses serviços, o máximo executável é o diagnóstico determinístico já produzido pelo script.
