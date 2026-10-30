# INBOX-06-R1 — Fechamento do Product Gate do Inbox

- **Sprint:** 4
- **Classificação:** `BLOCKER` de integração/gate
- **Owner:** coordenação/Codex; workers executam evidências delimitadas
- **Dependências:** INBOX-01 a INBOX-05 revisadas; INBOX-02-R3 concluída

## Objetivo

Transformar as implementações locais do PRD-002 em evidência integrada, reproduzível e revisável. Esta task não autoriza ainda commit, push, merge ou avanço para WhatsApp.

## Escopo

1. Consolidar matriz requisito → source → teste → evidência.
2. Reexecutar API/web lint, typecheck, unit, component, build e migrations.
3. Executar integração PostgreSQL descartável com tenant A/B, memberships e fake channel.
4. Verificar que platform admin/tenant manager não lê conteúdo, que notas privadas não chegam ao outbound e que anexos bloqueiam cross-tenant/path traversal.
5. Preparar ou validar script Playwright headless opt-in, com seed isolado, teardown seguro e artefatos sem secrets.
6. Registrar a limitação do BFF WebSocket e provar recuperação por REST após reconnect.
7. Confirmar backup/restore de anexos ou registrar bloqueio operacional explícito.

## Fora do escopo

WhatsApp real, Email real, AI, billing, novos providers, abstrações genéricas e módulos posteriores.

## Critérios de decisão

- `ACEITO`: todos os requisitos do PRD-002 e DoD global têm evidência revisada e CI relevante verde.
- `CORREÇÕES NECESSÁRIAS`: gap reproduzível de código/teste/documentação com owner e follow-up definido.
- `BLOQUEADO`: dependência externa, ambiente ou evidência essencial ausente sem substituto seguro.

## Artefatos obrigatórios

- matriz atualizada em `docs/engineering/tasks/PRD-002/`;
- comandos e outputs preservados em arquivos legíveis;
- decisão formal com responsável e próximo passo;
- nenhum commit/push até a decisão `ACEITO`.
