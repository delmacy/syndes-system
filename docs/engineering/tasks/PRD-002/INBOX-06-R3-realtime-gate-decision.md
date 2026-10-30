# INBOX-06-R3 — Decisão formal sobre realtime via BFF

- **Classificação:** `CORREÇÕES NECESSÁRIAS` (recomendação)
- **Natureza:** análise read-only; nenhum source, configuração, lockfile ou migration alterado; nenhum commit/push/autoaceite.
- **Owner do relatório:** coordenação/Codex; análise produzida por worker (inbox-worker, modelo NVIDIA).
- **Próximo owner sugerido:** OpenCode Free (NVIDIA) — web/BFF (`apps/web/src/app/api/backend/[...path]/route.ts`); revisão/aceite da coordenação/Codex.
- **Data:** 2026-10-29
- **Branch/HEAD de referência:** `work/prd-001-core-crm-sprint-0`, HEAD `7fa5cbdbfca90bb249736f292c76288e0e1c19c0`

---

## 1. Objetivo

Comparar a implementação WebSocket autenticada do backend realtime (INBOX-04) com a limitação do BFF Next.js (sem upgrade WebSocket) e recomendar decisão explícita: `ACEITO` (aceitar fallback REST/refetch no MVP), `CORREÇÕES NECESSÁRIAS` (abrir correção mínima server-side) ou `BLOQUEADO`, com impacto no Product Gate e próximo owner.

---

## 2. Escopo, método e limites

**Leitura somente (read-only).** Nenhum arquivo de `src/**`, configuração, `.env`, `package.json`, lockfile ou migration foi lido com intenção de alterar; apenas consultado para fundamentar a análise. Nenhuma execução de teste destrutiva, nenhum provider real, nenhuma seleção de tenant pelo cliente.

**Fontes consultadas:**
- `docs/product/PRD-002-INBOX-SPEC.md` (cap. 7 Tempo real; critérios de aceitação do Product Gate)
- `docs/engineering/INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md` (contrato de transporte WebSocket)
- `docs/engineering/tasks/PRD-002/INBOX-06-preflight-report.md` (gap G9)
- `docs/engineering/tasks/PRD-002/INBOX-05-nextjs-inbox.md` (limitação registrada no frontend)
- `docs/engineering/tasks/PRD-002/INBOX-06-R1-evidence.md` (estado do backend realtime)
- `AGENTS.md` (raiz) e `modules/inbox/AGENTS.md` (segurança: WebSocket/realtime valida tenant e usuário; nenhum ID externo seleciona tenant)
- `apps/api/src/modules/inbox/realtime/` (gateway, hub, authorizer, session, contracts, dto)
- `apps/web/src/app/api/backend/[...path]/route.ts` (BFF)
- `apps/web/src/modules/inbox/inbox-workspace.tsx` (fallback refetch, linhas 171–179)

---

## 3. Achados — backend realtime (INBOX-04, implementado e aceito)

O backend expõe `GET /api/v1/inbox/realtime`, upgrade para WebSocket, com as seguintes propriedades comprovadas por source:

| Propriedade | Como é garantido |
|---|---|
| Autenticação no handshake | Reusa `IdentityAuthGuard` + `TenantContextGuard` (mesmas duas guardas de toda rota Inbox REST); bearer + trusted-ingress injetados server-side |
| Tenant/database server-side | Resolvidos do contexto confiável do handshake; o URL nunca aceita seletor de tenant/database; seletor → `400` |
| Sem frames do cliente | Socket one-way server → client; qualquer frame do cliente fecha com `1008`; mutações vão pela REST autorizada |
| Eventos são ponteiros | `inbox.message.created`, `inbox.note.created`, `inbox.conversation.assigned`, `inbox.conversation.status.changed`, `inbox.attachment.created` carregam apenas ids/estado; corpos, notas privadas, nomes de arquivo, chaves, tenant ids e database names nunca viajam no socket |
| Sem buffer de reprise | Reconect reconstrui estado durável pela REST API (fonte da verdade) |
| Revalidação ao vivo | Membership e `customer_scope` re-lidos antes de cada entrega e periodicamente (timer, `1s–300s`, fail-closed); revogação fecha o socket (`1008`, `inbox.realtime.revoked`) |
| Isolamento cross-tenant | A lookup da conversa roda no banco do tenant da sessão; evento de outro tenant nunca é entregue |
| Origem do handshake | Valida `Origin` contra `API_ORIGIN` ou `WS_ALLOWED_ORIGINS` (fail-closed no boot); `403` para origem não permitida |
| Limites de consumo | `maxPayload`, `INBOX_REALTIME_MAX_FRAME_BYTES` (4 KiB), `INBOX_REALTIME_MAX_BUFFERED_BYTES` (1 MiB, slow consumer desconectado), `INBOX_REALTIME_MAX_EXPLICIT_SUBSCRIPTIONS` (50) |
| Fan-out | In-process, nó único do MVP; múltiplas réplicas precisariam de broadcast durável (ex. PostgreSQL `LISTEN/NOTIFY`), fora do escopo até ser requisito real |

**Conclusão do backend:** o transporte realtime autenticado está completo, seguro e coerente com o spec. Não há gap de código no backend.

---

## 4. Achados — limitação do BFF Next.js

O BFF é `apps/web/src/app/api/backend/[...path]/route.ts`:

- Exporta somente `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Não há upgrade WebSocket; a rota encapsula `fetch()` para `SYNDES_API_URL` com bearer + assinatura de ingress.
- Navegador não pode anexar `Authorization` a um `WebSocket` nativo, então o cliente web não pode chegar ao endpoint autenticado `/api/v1/inbox/realtime` através do BFF sem um proxy de mesma origem ou ponte server-side.

**Comportamento adotado pelo frontend** (`inbox-workspace.tsx`, linhas 171–179): refetch REST nos eventos `online` e `visibilitychange`, mantendo rascunho de resposta. A limitação é declarada honestamente no INBOX-05 R1: "O BFF Next.js atual não suporta upgrade WebSocket ... Comportamento seguro adotado: refetch REST via eventos `online`/`visibilitychange`; eventos realtime continuam sendo pointers que exigem refetch do REST."

---

## 5. Comparação: BFF versus backend realtime

| Dimensão | Backend realtime | BFF Next.js | Impacto |
|---|---|---|---|
| Transporte | WebSocket autenticado em `/api/v1/inbox/realtime` | Somente HTTP (`fetch`); sem upgrade WS | O browser não alcança o WS autenticado via BFF |
| Credenciais no handshake | Bearer + trusted-ingress injetados server-side | N/A (não há WS) | Token jamais chegaria na URL do WS (boa prática preservada) |
| Autorização | Guards no handshake + revalidação por evento | N/A | SemAuthz do BFF para substituir |
| Eventos | Ponteiros; reconnect via REST | Refetch REST em `online`/`visibilitychange` | Funcional, mas não é push em tempo real |
| Reconnect | Recupera estado persistido pela REST (sem buffer) | Mesmo comportamento via refetch | Atende ao requisito de reconnect do spec |

O gap é exclusivamente de transporte no BFF: o backend já entrega realtime autêntico; o BFF não consegue levá-lo ao navegador através de WebSocket. O fallback refetch mantém o produto funcional, mas não demonstra um evento realtime push na jornada.

---

## 6. Critérios aplicados (do escopo e do spec)

1. Não considerar ocultação de UI como autorização. — O fallback é honesto e documentado; não se finge autorização oculta.
2. Reconnect deve recuperar estado persistido sem depender de buffer. — O design realtime já é pointer + REST; o fallback é consistente.
3. Cross-tenant, scope e sessão revogada devem ser negados. — Garantido pelo backend em qualquer transporte; o BFF não enfraquece isso.
4. Não introduzir framework genérico nem provider externo. — Qualquer correção deve ser ponte server-side pontual, sem novo provider.

Critérios de aceitação do Product Gate (PRD-002) envolvidos: "Testes unitários, integração PostgreSQL, autorização/isolamento, ordenação/idempotência, **realtime**, anexos e componentes são criados junto a cada fatia e passam no CI" e cap. 7 "propagar eventos mínimos ... em tempo real; após reconexão, recuperar estado persistido pela API."

---

## 7. Decisão recomendada: `CORREÇÕES NECESSÁRIAS`

### Por que não `ACEITO`
O fallback REST/refetch é operacionalmente seguro e documentado, mas não é tempo real push. O spec lista realtime como capacidade MVP e critério de aceitação do Product Gate; hoje o frontend não demonstra um evento realtime push (apenas refetch ao voltar ao foco/reconectar). Aceitar a limitação sem correção deixaria o critério de aceitação de realtime não demonstrável (gap G9 do preflight, follow-up F10 do R1).

### Por que não `BLOQUEADO`
O backend realtime está completo, seguro e aceito (INBOX-04). O fallback mantém o produto operável (fila, detalhe, envio, nota, anexo, reconnect via REST). O gap é de transporte no BFF e tem correção mínima, server-side, sem reabrir escopo nem introduzir provider.

### Correção mínima proposta (server-side, sem alterar backend)
Implementar no BFF (`apps/web/src/app/api/backend/[...path]/route.ts` ou rota dedicada de mesmo origem) uma ponte WebSocket que:
1. Faça upgrade da conexão WebSocket de mesma origem.
2. Inje server-side o bearer e os headers de trusted-ingress (não coloque token nem tenant/id na URL do WS).
3. Valide `Origin` contra `API_ORIGIN` / `WS_ALLOWED_ORIGINS` (fail-closed).
4. Encaminhe para `GET /api/v1/inbox/realtime` do backend existente.
5. Sem alterar `apps/api`, sem novo provider, sem framework genérico.

Isso fecha o gap de transporte com mudança pontual no web/BFF, preservando toda a autorização do backend.

---

## 8. Próximo owner

**OpenCode Free (NVIDIA)** — detém o web/BFF (`apps/web/src/app/api/backend/` e `apps/web/src/modules/inbox/`, per INBOX-05 e `modules/inbox/AGENTS.md`). A coordenação/Codex faz a revisão e o aceite formal; não há autoaceite deste relatório.

---

## 9. Riscos e gaps residuais (não resolvidos por esta análise)

- A ponte WebSocket proposta ainda precisa ser implementada, testada e coberta por CI da árvore web.
- O frontend continua sem cliente WebSocket nativo; após a ponte, cabe ao web consumir o WS em vez de (ou junto com) o refetch.
- Isolamento cross-tenant, dedupe/ordenação e backup/restore de anexos permanecem sem prova executada em PostgreSQL nesta árvore (gaps G2/G3/G6 do preflight; fora do escopo deste R3).
- A entrega Inbox continua não rastreada (sem commit/CI desta árvore); pré-requisito para reavaliação do gate.

---

## 10. Evidência da execução read-only

- Nenhum comando de build/test/lint alterado; nenhum source modificado.
- Comandos executados: leitura de arquivos-fonte listados na seção 2 (consulta de conteúdo, não execução contra banco).
- Nenhum segredo exposto; `.env` local mantido fora da análise.
- Relatório como único artefato gerado; `INBOX-06-R3-realtime-gate-decision.md` (este arquivo).

---