# INBOX-05 — Frontend Next.js de atendimento

- **Módulo/gate:** Inbox / Sprint 3.
- **Classificação:** `MVP`.
- **Owner:** OpenCode Free (NVIDIA); Codex revisa.
- **Dependência:** INBOX-02 aceito; realtime/anexo de INBOX-04 disponível no contrato.

## Objetivo e ownership

Criar a tela compartilhada da caixa Inbox com fila, filtros simples, painel de conversa, timeline de mensagens, enviar resposta ou nota privada, assignment, status, anexos e reconexão. Ownership: `apps/web/src/modules/inbox/**`, rota de composição e testes desta UI.

## Regras

- Usar autenticação/BFF e contratos existentes; não guardar token em storage de browser, não enviar tenant/database selecionável pelo client e não duplicar autorização.
- Exibir atendente pelo Employee associado quando disponível; identity actor continua chave de autorização.
- `tenant_member` recebe somente itens permitidos pelo API; não simular scopes no client.
- Distinguir visual e acessivelmente nota privada de mensagem enviada; confirmar estados de envio, falha, retry e atualização externa.
- Tratar fila vazia, sem resultado, loading, 401/403, erro 5xx, conflito concorrente, anexo rejeitado e reconnect sem perda de texto rascunho.

## Aceite

- Vitest/component tests cobrem role/scope, estados de fila, enviar/note, assignment/status, upload/falha e atualizações realtime.
- A UI não apresenta mensagens não autorizadas nem conta como authz a ocultação de controles.
- Lint, typecheck, tests e build web passam. Script Playwright pode ser implementado para o gate mas fica opt-in e não é executado nesta task.

## R1 — Correção frontend (execução 2026-10-28)

- **Classificação:** `BUG` (executor) com correção de escopo já aceito (`MVP`).
- **Owner executor:** OpenCode Free (NVIDIA); revisão/aceite Codex permanece com o coordenador.

### Correções desta rodada

1. Histórico de conversa agora consumido pelo contrato autorizado `GET /inbox/conversations/:id/messages?after=&limit=` (limite interno de leitura `200`), em vez de assumir timeline embutida no detalhe.
2. Input de anexo resetado após cada seleção, permitindo reenviar o mesmo arquivo.
3. Testes corrigidos para afirmar o comportamento renderizado real: marcador de nota privada (`.message-note-tag`) e rótulo do formulário de nota (`Nota privada`).

### Evidência (comandos reais)

- `npm run typecheck` (apps/web): **passou** (0 erros).
- `npm run lint` (apps/web): **passou** (0 erros).
- `npm test` (apps/web): **10 arquivos / 39 testes passando** (suite Inbox: 15/15).
- `npm run build` (apps/web): **passou** com variáveis de build de CI (`AUTH_SECRET`, `AUTH_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_WEB_CLIENT_ID`, `KEYCLOAK_WEB_CLIENT_SECRET`, `SYNDES_API_URL`, `INGRESS_SIGNING_SECRET`).

### Cobertura validada

- Sessão/carregamento, fila vazia/erro, abertura de conversa e histórico, resposta com `Idempotency-Key`, nota privada (sem reply público), assignment/status, upload permitido/rejeitado/erro e refetch seguro pós-reconnect.

### Limitação registrada para INBOX-06

- O BFF Next.js atual (`/api/backend/[...path]`) não suporta upgrade WebSocket; handshake realtime não foi inventado no frontend. Comportamento seguro adotado: refetch REST via eventos `online`/`visibilitychange`; eventos realtime continuam sendo pointers que exigem refetch do REST.

### Fora do escopo desta correção

- Backend (`apps/api/src/modules/inbox/**`) permanece com dono das tasks INBOX-02/INBOX-06.
- Aceite do gate Codex não foi auto-concedido por esta correção.
