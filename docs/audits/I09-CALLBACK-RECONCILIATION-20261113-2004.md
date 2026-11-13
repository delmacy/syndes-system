# I09 / P03 — Reconciliação do callback Whatsmeow e fronteiras de ownership

**Data:** 2026-11-13 (America/Sao_Paulo)  
**Base de leitura GitHub main:** `fa10ac79ce5e229d2f292b5358ff421400281e68`  
**Estado:** auditoria estática parcial; nenhum teste executado, nenhuma implantação ou homologação comprovada.  
**Escopo:** continuação da auditoria I09, com foco na fronteira Go gateway → módulo WhatsApp NestJS → persistência/projeção. Não substitui a auditoria das 57 unidades.

## Divergência documental confirmada

`modules/whatsapp/README.md`, na seção "Current audit (2026-11-02)", ainda afirma que o callback `POST /api/v1/internal/whatsapp/events/{tenantId}` não existe no Core Host ou Inbox examinados naquela data. O **código atual** em `modules/whatsapp/src/inbound-http.ts` contém `WhatsAppInboundController` com `@Controller("api/v1/internal/whatsapp/events")` e `@Post(":tenantId")`. `modules/whatsapp/src/plugin.ts` importa `WhatsAppInboundHttpModule` em `WhatsAppApiModule`. A afirmação histórica deve receber qualificador temporal, não ser apagada nem reinterpretada como ausência atual. A existência do controller não prova que o plugin está carregado em runtime.

## Contratos públicos/privados e classes verificadas

| Owner | Classe/contrato | Evidência de código | Limite |
|---|---|---|---|
| WhatsApp NestJS | `WhatsAppInboundController.receive` | Rota interna `POST /api/v1/internal/whatsapp/events/:tenantId`, bearer interno, validação de envelope e respostas 401/400/503 | Rota declarada; ativação e entrega real não verificadas |
| WhatsApp NestJS | `verifyWebhookToken` | Comparação de hash SHA-256 com `timingSafeEqual`; nega segredo ausente | Autenticação por segredo compartilhado interno, não FGA de usuário |
| WhatsApp NestJS | `WhatsAppInboundStore.persist` | INSERT ... SELECT por conta habilitada com `platform_organization_id IS NOT NULL`; conflito idempotente por tenant/account/external ID | Não comprova compatibilidade de cada versão do gateway Go |
| WhatsApp NestJS | `WhatsAppInboundService` | Provedor de banco `SYNDES_TENANT_DB`; verifica `db.tenantId===tenantId` | Banco real não exercitado |
| WhatsApp NestJS | `WhatsAppAccountsController` | `GET /v1/tenants/:tenantId/whatsapp/accounts`, `GET /:accountId`, `POST /`, `POST /:accountId/pair` e outras rotas no `http.ts` | Rotas de operador separadas do callback interno |
| WhatsApp | `WhatsAppInboxProjection` | Projeção de eventos persistidos para Inbox em `dispatch.ts` | Não comprova execução do worker nem SSE entre réplicas |
| WhatsApp | `WhatsAppOutboundRelay` | `sendQueued`, `outboundStatus`, idempotência e estados persistidos em `outbound-relay.ts` | Entrega externa e tratamento de falhas não homologados |
| WhatsApp | `WhatsAppDispatchWorker` | Classe de ciclo de vida NestJS em `dispatch-worker.ts` | Presença da classe não prova worker operacional |

## Eventos, schemas e migrations

- O callback valida quatro famílias de envelope por `validIncomingEnvelope`, `validChatEnvelope`, `validContactEnvelope`, `validReceiptEnvelope`. As chaves de deduplicação incluem prefixos derivados de hashes para chat, receipt e contact; mensagens usam `externalMessageId`.
- `WhatsAppInboundStore` registra `whatsapp_inbound_events` apenas se a conta estiver habilitada e possuir organização proprietária. Em conflito, retorna `{accepted:true,duplicate:true}` quando o registro existente pertence a conta elegível; caso contrário responde 404.
- `plugin.ts` declara migrations `001_whatsapp_accounts` a `008_whatsapp_projection_owner`; a 008 introduz a escolha imutável de `projection_path` entre `legacy` e `events`. Não há evidência de aplicação dessas migrations em banco ativo.
- Eventos internos e persistência não devem ser confundidos com publicação no Event Bus ou confirmação de entrega de WhatsApp.
- `modules/organizations/sql/004_whatsapp_route_owner_guard.sql` é ownership de Organizations, não migration I09 isolada; o teste de isolamento de WhatsApp a utiliza como dependência.

## Testes localizados e NÃO executados

- `modules/whatsapp/test/pg-org-scope.mjs` define teste de isolamento de duas organizações dentro de um tenant, condicionado a `SYNDES_INBOX_SCOPE_TEST_PG_URL` para PostgreSQL descartável.
- O teste contém fixtures transacionais, aplica SQL no schema efêmero e derruba índices single-context **apenas dentro do teste com rollback**; não foi executado nesta auditoria.
- Não foram executados Go tests, npm tests, PostgreSQL, HTTP E2E, CI, replay de callback ou validação de GitHub Pages. Nenhum serviço, migration ou segredo foi acessado.

## Pendências e revisão

1. Conferir, por SHA, o emissor Go atual e os headers/formatos de todos os envelopes contra `inbound-contract.ts`, incluindo versionamento e replays.
2. Verificar configuração do Core Host, allowlist e autorização de carregamento do plugin; nunca inferir implantação a partir de imports.
3. Inspecionar testes unitários/integração por contrato e seus resultados de CI na mesma SHA; executar somente em ambiente descartável autorizado.
4. Atualizar README histórico com adendo datado, preservando o registro original e distinguindo implementação de ativação.
5. Reconciliar STATUS e referência técnica I09/P03 somente após revisão independente e confirmação de concorrência.

**Gate:** checkpoint de auditoria, sem Product Gate, sem merge, sem evidência de deploy. Outras unidades do catálogo continuam pendentes.
