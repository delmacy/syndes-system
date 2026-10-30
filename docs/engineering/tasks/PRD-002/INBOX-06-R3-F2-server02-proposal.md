# INBOX-06-R3-F2 — Proposta de deployment server02: ponte WebSocket same-origin

## 1. Contexto e decisão

O runtime atual da web (`apps/web`) é Next.js 16.4.3 App Router. As route handlers
(`apps/web/src/app/api/backend/**/route.ts`) exportam apenas manipuladores de
método HTTP (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`) e **não expõem o
evento `upgrade` do servidor HTTP nem o objeto de socket subjacente**. Portanto
não é possível implementar um upgrade bruto de WebSocket dentro de
`route.ts` usando apenas as APIs públicas do Next.js.

Prova executável:
- `apps/web/src/app/api/backend/inbox/realtime/route.proof.spec.ts` (4 testes)
  - A rota ponte exporta apenas `GET` (nenhum manipulador de upgrade WebSocket).
  - Com sessão válida, responde `501 websocket_upgrade_not_supported` (não `101
    Switching Protocols).
  - Não coloca token nem tenant na URL de destino do backend.
  - Rejeita seletor de tenant na query (`400`).

Conclusão: a ponte WebSocket real **requer um servidor dedicado ou proxy de
mesma origem** fora do App Router. Esta proposta define o deployment `server02`
que preenche esse gap sem alterar `apps/api`, sem novo provider e sem framework
genérico.

## 2. Objetivo da ponte server02

Expor, de mesma origem que o frontend, um endpoint WebSocket
`GET /api/backend/inbox/realtime` que:

1. Faça upgrade da conexão WebSocket do navegador.
2. Valide `Origin` (fail-closed contra a aplicação configurada).
3. Resolva a sessão NextAuth server-side e obtenha o `accessToken`.
4. InjetE server-side `Authorization: Bearer <accessToken>` e os headers de
   trusted-ingress (`x-syndes-validated-host`, `x-syndes-validated-at`,
   `x-syndes-validated-signature`).
5. Nunca coloque token, tenant ou database na URL do WebSocket.
6. Encaminhe o upgrade para `GET <SYNDES_API_URL>/api/v1/inbox/realtime`
   (backend existente, sem alterar `apps/api`).
7. Seja unidirecional (servidor → cliente); frames do cliente fecham com `1008`.

O cliente frontend (`InboxRealtimeClient`, já implementado em
`apps/web/src/modules/inbox/realtime.ts`) conecta a um path de mesma origem
sem parâmetros sensíveis e faz refetch do estado durável via REST na
(re)conexão.

## 3. Pré-requisitos para server02

| Pré-requisito | Detalhe |
|---|---|
| Runtime Node.js | v20+ (mesmo da web) para rodar o servidor `ws`. |
| Pacote `ws` | Adicionar `"ws": "^8.22.0"` às dependências de `apps/web` (mesma versão já usada em `apps/api`). |
| Variáveis de ambiente | `AUTH_SECRET`, `AUTH_URL`, `SYNDES_API_URL`, `INGRESS_SIGNING_SECRET`, `NEXT_PUBLIC_APP_ORIGIN` (ou `APP_ORIGIN`), `WS_ALLOWED_ORIGINS` (opcional, allowlist de origens de proxy). |
| Mesma origem | server02 deve responder na mesma origem do frontend (mesmo host/porta) para que cookies de sessão NextAuth e `Origin` do navegador correspondam. |
| Sessão NextAuth | server02 deve ler o cookie de sessão (`syndes.session-token` / `__Host-syndes.session-token`) e verificar a JWT assinada com `AUTH_SECRET` para obter `accessToken`. |
| Backend já provisionado | `GET /api/v1/inbox/realtime` do backend (`apps/api`) operante, com `IdentityAuthGuard` + `TenantContextGuard` (INBOX-04 já aceito). |
| TLS | Em produção, server02 atrás de terminação TLS; `Secure`/`__Host-` cookie só enviado sobre HTTPS. |

## 4. Arquitetura

```
navegador (mesma origem)
      │ WebSocket upgrade + Origin
      ▼
server02 (Node + ws)
  1. Lê cookie NextAuth → verifica JWT (AUTH_SECRET) → accessToken
  2. Valida Origin (fail-closed: aplicação / WS_ALLOWED_ORIGINS)
  3. Rejeita query params tenant/token/database (400)
  4. Injeta Authorization: Bearer <accessToken> + x-syndes-validated-*
  5. Faz upgrade para SYNDES_API_URL/api/v1/inbox/realtime
      │ upgrade (bearer + trusted-ingress)
      ▼
apps/api (backend, existente) — /api/v1/inbox/realtime
  - IdentityAuthGuard + TenantContextGuard no handshake
  - Hub: eventos ponteiros, revogação (1008), sem replay buffer
```

server02 é um servidor HTTP dedicado que compartilha o host/porta do frontend (ou
fica atrás de um reverse proxy mesmo-origem que encaminhe `/api/backend/inbox/realtime`
para ele e mantenha o restante das rotas Next.js). Ele não substitui o Next.js;
somente assume o upgrade WebSocket nesse path.

## 5. Contrato de segurança preservado (sem alterar apps/api)

| Propriedade | Como é garantida em server02 |
|---|---|
| Token nunca na URL | `Authorization` injetado server-side; cliente conecta a path de mesma origem sem query sensível. |
| Nenhum seletor de tenant do cliente | server02 rejeita query params tenant/token/database (`400`); tenant resolvido server-side pela sessão + trusted-ingress. |
| Origin validada (fail-closed) | server02 valida `Origin` contra aplicação configurada / `WS_ALLOWED_ORIGINS`; origem não permitida → `403`, sem upgrade. |
| Autenticação server-side | server02 verifica sessão NextAuth (JWT `AUTH_SECRET`); sessão inválida → `401`. |
| Eventos são ponteiros | backend já envia apenas ids/estado; nenhum corpo, nota privada, nome de arquivo, tenant id ou database name viaja no socket. |
| Reconnect refetch estado | `InboxRealtimeClient` chama `onRefetchState` na (re)conexão (REST é fonte da verdade). |
| Isolamento cross-tenant | mantido pelo backend (INBOX-04); a ponte não enfraquece autorização. |

## 6. Variáveis de ambiente (server02)

| Variável | Obrigatório | Exemplo / uso |
|---|---|---|
| `AUTH_SECRET` | sim | Segredo da sessão NextAuth (mesmo da web). |
| `AUTH_URL` | sim | URL do NextAuth (mesmo da web). |
| `SYNDES_API_URL` | sim | Base do backend (ex. `http://localhost:3001`). |
| `INGRESS_SIGNING_SECRET` | sim | Segredo de trusted-ingress (mesmo da web e API). |
| `NEXT_PUBLIC_APP_ORIGIN` / `APP_ORIGIN` | sim | Origem da aplicação para validação de `Origin`. |
| `WS_ALLOWED_ORIGINS` | não | Allowlist de origens de proxy (vírgula separada). |
| `NODE_ENV` | sim | `production` ativa cookies `__Host-`/Secure. |

## 7. Integração com o frontend

- `buildRealtimeUrl("/api/backend/inbox/realtime")` → path de mesma origem (sem host, sem token/tenant).
- `InboxRealtimeClient` conecta a esse path; `Origin` do navegador é a mesma aplicação → passa na validação de server02.
- Na (re)conexão, `onRefetchState` dispara refetch REST da fila/detalhe/mensagens (fonte da verdade).
- Enquanto server02 não estiver provisionado, `route.ts` retorna `501` e o cliente degrada para refetch REST em `online`/`visibilitychange` (comportamento INBOX-05).

## 8. Não alterado

- `apps/api` — intacto (backend realtime já aceito, INBOX-04).
- Não há framework genérico, novo provider, plugin engine ou marketplace.
- Não há token nem tenant na URL do WebSocket.
- Não há autoaceite; revisão/aceite cabe à coordenação/Codex.

## 8.1 Verificação de acesso — 2026-10-29

- DNS/Tailscale: `server02.tayra-delta.ts.net` resolve para `100.75.65.12`.
- Rede: TCP `22` acessível pela interface Tailscale.
- Orca local: nenhum environment remoto `server02` está cadastrado.
- SSH: o usuário local `admin` foi recusado pela política Tailscale; tentativa com `root` solicitou autenticação interativa em `login.tailscale.com`.
- Resultado: provisionamento não iniciado. É necessário autenticar o dispositivo Tailscale ou fornecer um usuário SSH autorizado antes de executar `INBOX-06-R3-F3`.

## 8.2 Tentativa de provisionamento interrompida — 2026-10-29

- O acesso `root@server02` foi confirmado e a task `INBOX-06-R3-F3` foi iniciada com OpenCode2/NVIDIA.
- A execução foi interrompida antes de qualquer deploy porque o worker consultou e imprimiu valores de ambiente do container durante a inspeção.
- O dispatch foi parado e a task foi marcada como falha de segurança; nenhum bridge foi instalado ou alterado.
- Pré-condição para nova tentativa: rotacionar os secrets do stack de teste e usar inspeção redacted (somente nomes, status e hashes não reversíveis), sem `docker inspect` de ambiente em output.
- A remediação foi registrada no Orca como `task_532886b13aea` (`INBOX-06-R3-F3-R1`); permanece pronta, aguardando autorização explícita para rotação e reinício dos serviços de teste.

## 8.3 Segunda tentativa interrompida — 2026-10-29

- A task rotacionou `.env.test`/`compose.yaml` com backup, mas falhou ao sincronizar a credencial do PostgreSQL porque o role administrativo assumido não existe.
- O worker imprimiu o novo valor durante a tentativa de correção; esse valor deve ser tratado como comprometido.
- O dispatch foi parado antes de restart/deploy. Estado verificado: containers existentes continuam `healthy`, PostgreSQL aceita conexões, Web responde `307`, Keycloak responde `200`; os containers ainda usam o ambiente carregado anteriormente.
- Próximo passo obrigatório: nova rotação por procedimento revisado e executado diretamente por operador autorizado, usando variável interna sem retorno de valor, validar o role real do banco e só então reiniciar/reprovisionar. Não reusar os backups como estado final sem rotacionar novamente.

## 8.4 Remediação direta e estado atual — 2026-10-29

- A coordenação executou uma nova rotação não interativa diretamente no `server02`, sem imprimir valores; o role real `api_ci` foi atualizado usando entrada interna ao `psql`.
- API, Web e PostgreSQL foram recriados/validados: API `200`, Web `307`, Auth providers `200`, PostgreSQL healthy; `.env.test` permanece `0600`.
- Duas tentativas de worker para provisionar o bridge foram interrompidas por violações de inspeção segura (leitura ampla de arquivos/configuração). Nenhum bridge foi instalado.
- O Product Gate continua `CORREÇÕES NECESSÁRIAS`: realtime browser e smoke test WebSocket `101` ainda não estão provados.

## 9. Próximos passos

1. Revisar e aceitar esta proposta e a prova executável (`route.proof.spec.ts`).
2. Provisionar server02 (Node + `ws`) nos pré-requisitos da seção 3.
3. Ligar `InboxRealtimeClient` ao `InboxWorkspace` para consumir eventos realtime.
4. Executar lint/typecheck/test/build de `apps/web`.
5. Coordenação/Codex revisa evidências e decide o Product Gate.
