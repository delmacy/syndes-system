# IAM-07A — SSE com reautorização fresca e revogação real em laboratório

**Data:** 2026-11-18. **Estado:** candidato para CI da PR, não homologado nem conectado ao IAM operacional.

## Motivo e alteração

A versão anterior de `InboxChangeBus.connect` reutilizava a promise de uma checagem pendente entre o heartbeat/período e a publicação `changed`. Uma invalidação posterior à revogação podia receber o resultado de uma verificação iniciada antes dela. O IAM-07A remove esse compartilhamento de resultado: toda publicação precisa de uma **checagem nova**, e bursts são coalescidos para limitar pressão nos provedores. Uma revogação ou erro fecha a sessão e remove seus listeners. O retorno de escrita `false` do sink também encerra o stream para evitar buffering ilimitado em cliente lento.

Esta correção muda o mecanismo SSE já existente em `modules/inbox/src/realtime.ts`, com efeito na modalidade já configurada `revalidate`. **Não** altera automaticamente `InboxHost.requiresStreamRevalidation`, que continua vinculado ao rollout ENABLED do módulo, nem introduz a validação Organizations no endpoint operacional. O modo legado sem callback conserva o comportamento previamente definido.

O piloto `apps/core-host/src/iam07-sse-session-pilot.ts` somente pode abrir sessão com `inbox.conversation.read`, bearer original e contexto imutável; revalida todo o caminho `OrganizationContextAdmissionPilot.resolve` (JWT iss/aud/azp/sub, Control/tenant, módulo, link, live Keycloak membership, workspace SQL002), identidade e escopo exatos, mais a decisão efetiva OpenFGA no final. **Não é importado por main.ts nem instalado no Inbox operacional.**

## Aceite real descartável

Reusa o `tests/platform/iam06b-composite-ci.mjs` dentro do job `keycloak-real-jwt` do CI existente, com Keycloak 26.8.1, PG17 Control, PG17 tenant independente e OpenFGA v1.22.1 em memória. O `tests/platform/iam07-sse-live-ci.mjs` conecta `InboxChangeBus` de verdade a `Iam07SseSessionPilot`, usando o mesmo JWT humano assinado e as mesmas fixtures dos adapters de IAM-06B. Testa separadamente:

1. Conexão inicial e múltiplas consultas de identidade+membership+FGA válidas.
2. Publish de outro tenant / Organization / Workspace sem invalidação do listener observado; pedido de outra org sem SQL002/membership é negado.
3. Retirada de tuple OpenFGA, membership workspace do banco tenant, entitlement Inbox no Control, link Organization no Control e membership real no Keycloak: cada cenário fecha a conexão ativa e bloqueia novo `changed`, sem trocar o JWT.
4. Endpoint OpenFGA propositalmente indisponível em loopback falso: abertura é negada. Não é um ensaio de parada/recovery de serviço de produção.
5. Amostra sequencial de 14 revalidações end-to-end reais, reportando p95 em milissegundos **sem** PII. É uma medição de ambiente descartável; não serve como SLO de produção.
6. Testes determinísticos `modules/inbox/test/realtime.test.mjs` mostram a corrida entre checagem anterior e nova invalidação, coalescência de 100 eventos, isolamento de channel e fechamento por backpressure.

Marcadores esperados depois de CI:

`IAM07_REAL_SSE_FGA_SQL_MODULE_LINK_ORG_REVOCATION_PASS`

`IAM07_REAL_SSE_CROSS_SCOPE_AND_PROVIDER_FAILURE_DENY_PASS`

`IAM07_REAL_CI_REVALIDATION_P95_MS=...` — medição descartável, sem comprometer meta de p95 de produção.

## Limites obrigatórios

- A garantia vale para **nova notificação `changed` após uma checagem atual**. A remoção de membership em serviços independentes não é transação atômica com OpenFGA nem com a checagem que já começou; não alegar prevenção absoluta de TODAS as races de revogação com efeito de negócio.
- Não existe coordenação de invalidação entre múltiplos processos ou Core Hosts. O bus ainda é **in-memory single-host**; em escala horizontal será necessário broker compartilhado e mecanismo de epoch/fencing ou revogação transacional.
- Não há lifecycle de token via frontend nem teste de desconexão HTTP real/Proxy em produção. Não há efeito SQL de reply, claim, transfer ou funnel executado durante revogação.
- IAM-06 é comparador coarse de `read` e `send`, não contrato granular final. Não conceder `claim/transfer/funnel` como sinônimo de `write`. O índice único SQL 002 bloqueia segunda Organization/Workspace no mesmo tenant; não o retirar para cumprir a matriz A/B.
- Não fazer mudança no realm `syndes`, schema Control operacional, Secret/OpenBao, OpenFGA store real, main.ts, ativação de keycloak membership runtime ou deploy manual.
- A migração 003 de Organizations permanece apenas parcialmente montada na fixture PG17 de IAM-06B; os objetos runtime reais seguem dependentes do Product Gate.

## Próxima sequência de trabalho

**IAM-07B**: ensaio em HTTP real (401/403, restart/reconexão de SSE, expiração do JWT), teste de transfer/claim/funil com efeitos concorrentes e locks SQL; fault injection independente para Keycloak/Control/tenant/FGA, recuperação, latência p95 sob carga e multi-processo. **IAM-09** somente após Product Gate CRM/Inbox, restore/rollback e isolamento físico integral.

Rastreamento: Issue #160, WBS IAM, PR desta entrega. A classificação permanece **BLOCKER de segurança para ativação operacional**, não um novo produto do MVP.
