# INBOX-06-R4 — CI, rastreamento e decisão final

- **Classificação:** `BLOCKER` de integração
- **Owner:** coordenação/Codex
- **Dependências:** INBOX-02-R4, INBOX-04-R2, INBOX-06-R2 e INBOX-06-R3

## Objetivo

Rastrear somente os arquivos aprovados, separar artefatos temporários, rodar CI relevante e decidir formalmente o Product Gate.

## Gate

- revisar `git diff` e ownership antes de staging;
- preservar testes existentes e lockfile;
- rodar integrity, lint, typecheck, unit, component, build, migration/integration e security checks;
- abrir/atualizar PR somente após decisão `ACEITO` autorizada;
- push não é permitido antes de CI local e revisão de segurança verdes.

## Saída

## Execução do gate — 2026-10-29

### Evidência local

- API unit: `51 suites`, `351 tests` aprovados (`apps/api`, `npm run test:unit`).
- API typecheck: aprovado (`npm run typecheck`).
- API build: aprovado (`npm run build`).
- Web Vitest: `13 files`, `62 tests` aprovados (`apps/web`, `npm test`).
- Web lint: aprovado (`npm run lint`).
- Web typecheck: aprovado (`npm run typecheck`).
- INBOX-02-R4: 75 testes de gaps de segurança adicionados e verdes.
- INBOX-04-R2: drill de restore de anexos 24/24 checks aprovados.
- INBOX-06-R2-F1: harness Playwright executável e diagnóstico estruturado; execução completa bloqueada por PostgreSQL, API e Keycloak ausentes no ambiente.
- INBOX-06-R3-F2: prova executável confirma que App Router retorna `501`, não `101`; não há bridge WebSocket runtime disponível.

### Atualização de execução — 2026-10-29

- Server02 provisionado e verificado sem expor credenciais: PostgreSQL, API e Web saudáveis; API `200`, providers de autenticação `200`.
- Bridge same-origin foi implementado em `apps/web/scripts/start-web.mjs`, anexado ao servidor HTTP customizado e publicado no stack descartável. A sessão Auth.js é decodificada exclusivamente server-side; o upstream recebe bearer e assinatura de ingress, sem token/tenant na URL.
- Smoke negativo no server02: WebSocket sem sessão retorna `401`; Origin inválida retorna `403`; REST Inbox sem sessão retorna `401`.
- Fonte do Inbox foi sincronizada no stack descartável e o API passou a carregar o módulo realtime com `ws`; migrations de control-plane continuam aplicando.
- E2E autenticado ainda não foi provado: o container não possui browser Playwright e o download/instalação não concluiu dentro do ambiente disponível. A execução tentou iniciar a jornada e falhou antes do teste por `browserType.launch: Executable doesn't exist`.
- Após instalar o Chromium headless no container, a jornada Inbox foi executada novamente e falhou no primeiro passo (`login_and_tenant_context`, 6,3s): a página não chegou ao heading `Caixa de Entrada`. Portanto ainda não há evidência de login/tenant, `101` autenticado ou mutações Inbox.
- Depois de alinhar o client secret ao realm descartável, aplicar as migrations Inbox no banco do tenant e corrigir o harness, a jornada autenticada completa passou no server02: `login_and_tenant_context`, `queue_visible`, `open_conversation`, `assign_conversation`, `send_reply`, `save_private_note`, `change_status`, `upload_attachment` e `reconnect_refresh` — todos `passed` (3,7s).
- Diagnóstico final do realtime: o bridge alcança o API e os guards registram identidade/tenant corretamente, mas o upgrade público via Tailscale Serve retorna `502`; o `101` não chega ao cliente. O bloqueio está no encaminhamento de upgrade do proxy público, não na autorização ou no fluxo Inbox.

### Decisão

`CORREÇÕES NECESSÁRIAS`.

O código e os testes locais estão verdes, e a jornada E2E autenticada completa foi provada no server02. Por decisão explícita de deployment, o Product Gate operacional do Inbox é aceito no escopo Tailscale; a exposição pública e seu smoke `101` ficam deliberadamente deferred até liberação futura de porta. REST, login, isolamento, mutações, anexos e reconnect por refetch estão comprovados. Não abrir porta pública como parte deste módulo.
