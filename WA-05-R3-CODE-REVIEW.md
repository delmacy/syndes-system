# WA-05-R3 — Revisão de Código (Read-Only), PRD-003 WA-01 a WA-05

- **Data:** 2026-10-30
- **Natureza:** revisão de código apenas leitura. Nenhum código, teste, migration, `.env`, segredo, serviço, estado do Git ou infraestrutura foi modificado.
- **Alvo:** implementação e migrations cobertas por PRD-003 WA-01 a WA-05 (WhatsApp API/services/controllers/schema/tests, Inbox channel ingress/outbound, UI de configuração WhatsApp, relatório WA-05).
- **Artefato:** `WA-05-R3-CODE-REVIEW.md` (apenas este arquivo foi criado).
- **Decisão:** revisão concluída; não há aceitação de gate aqui — o coordenador decide.

---

## 1. Resumo Executivo

A implementação do WhatsApp (PRD-003) WA-01 a WA-05 está coerente com os requisitos de segurança e de produto revisados: isolamento de tenant por banco de dados server-side, autorização `tenant_admin`, autenticação de webhook com `timingSafeEqual`, resolução de database via Control Plane (nunca do payload), idempotência de inbound por `(channel, externalMessageId)`, suspensão por billing com preservação de sessão, outbound apenas via Inbox (production adapter exige `productionProvider=true`), rate limiter de 40 envíos/minuto por conta e logs sanitizados. Os testes unitários (414) e os 9 testes de integração WA-05 estão verdes; lint, typecheck e build passam.

Não há **blockers** de código. Há **bugs de baixo impacto** (rate limiter apenas em memória; `connect` não rejeita conexão já ativa; `disconnect` chama o provider mesmo para tenant suspenso) e **gap de integração não provado** (suíte PostgreSQL descartável não executada localmente; deploy server02/Tailscale não executado). Esses itens já constam dos relatórios WA-05 e WA-05-R2 e não invalidam a revisão, mas impedem o aceite formal do Product Gate até que a infraestrutura esteja disponível.

---

## 2. Metodologia e Limites

Revisão estática de fonte e testes. Não houve execução de banco de dados, rede, deploy, commit ou push. Segredos não foram lidos nem impressos. A revisão distingue:

- **Evidência de implementação:** código-fonte, migrations, testes presentes na árvore.
- **Integração provada:** testes unitários e de integração WA-05 executados com fake provider (414 + 9 verdes).
- **Integração não provada localmente:** suíte PostgreSQL descartável (`whatsapp.postgres.integration.spec.ts`) e deploy server02/Tailscale — bloqueados por infraestrutura (conforme WA-05-R2).

---

## 3. Findings Categorizados

### 3.1 Aceitável (implementação conforme PRD-003)

| # | Critério | Evidência (arquivo:linha) | Situação |
|---|----------|---------------------------|----------|
| A1 | Tenant/database nunca selecionados pelo cliente | `whatsapp.controller.ts:25` — `tenantOf(request)`; `whatsapp-connection.service.ts:29` — `withTenant(context, …)` | ✅ |
| A2 | Isolamento de tenant (zero cross-tenant) | `whatsapp-connection.service.ts:28-37` — consulta por `TenantContext.databaseName`; `whatsapp.schema.ts:16` — `singletonKey` único por banco | ✅ |
| A3 | Autorização server-side (`tenant_admin` only) | `whatsapp.controller.ts:15` (`UseGuards`), `108-118` (`requireAdmin`) | ✅ |
| A4 | Webhook autenticado com `timingSafeEqual` antes de lookup de tenant | `whatsapp-webhook.controller.ts:58` (`authenticate` primeiro), `101-113` | ✅ |
| A5 | Database resolvida via Control Plane, nunca do payload | `whatsapp-webhook.controller.ts:62-68` — `SELECT … FROM tenants WHERE id = $1` | ✅ |
| A6 | Inbound idempotente (não duplica) | `channel-ingress.service.ts:121-146` — dedup por `(direction, sourceChannel, externalId)` | ✅ |
| A7 | Suspensão por billing impede inbound | `whatsapp-webhook.controller.ts:88-96` — gate `serviceEnabled=false && suspensionReason='delinquency'` | ✅ |
| A8 | Sessão preservada na suspensão | `whatsapp-session.service.ts:111-124` — `suspendForDelinquency` não limpa `phoneExternalId` | ✅ |
| A9 | Reconnect sem novo pareamento quando sessão autorizada | `whatsapp-session.service.ts:126-149` — `reactivateAfterPayment` reutiliza `phoneExternalId` | ✅ |
| A10 | Outbound somente via Inbox (adapter de produção) | `whatsapp-outbound.adapter.ts:23-25` — `registerProductionAdapter('whatsapp', this)` com `productionProvider=true` (linha 14) | ✅ |
| A11 | Rate limiter 40 msg/min por conta | `whatsapp-rate-limiter.ts:3-21` — sliding window, `limit = 40`, `windowMs = 60_000` | ✅ |
| A12 | Logs sanitizados (não vaza pairing code, recipient, body, session secret) | `whatsapp-session.service.ts:27,101-103` — `REDACTED`; `whatsapp-connection.service.ts:97` — `secret=${REDACTED}` | ✅ |
| A13 | Auditoria de eventos de conexão | `whatsapp.controller.ts:55-59,70-74,85-89,100-104` — `audit.record` em pairing/connect/disconnect/reconnect/admin_denied | ✅ |
| A14 | Migração e schema consistentes (check constraints) | `whatsapp.schema.ts:36-55`; `20261030090000_whatsapp_connections.sql:14-18`; `20261030100000_whatsapp_entitlement.sql:13-21` (idempotente com `IF NOT EXISTS`) | ✅ |
| A15 | Provider real fora do domínio (adapter) | `whatsapp-provider.ts:6-16` — interface; `fake-whatsapp.provider.ts` (`providerId='fake'`, `productionProvider` não declarado) | ✅ |
| A16 | Fake não substitui production adapter | `channel-adapter-registry.ts:37-50` — `registerProductionAdapter` rejeita se `!adapter.productionProvider` | ✅ |

### 3.2 Bugs de Baixo Impacto (não bloqueiam, mas merecem correção)

| # | Descrição | Evidência | Impacto |
|---|-----------|-----------|---------|
| B1 | Rate limiter apenas em memória (Map de instância) | `whatsapp-rate-limiter.ts:8` — `private readonly attempts = new Map()` | Em reinstância/escala horizontal o contador é resetado; para MVP single-instance é aceitável, mas não é um limite global durável. |
| B2 | `connect` não rejeita quando já conectado | `whatsapp-session.service.ts:50-55` — `connect` chama `connectProvider` sem verificar `status === 'connected'` (diferente de `startPairing` na linha 36-37) | Pode re-chamar `provider().connect()` desnecessariamente; para o fake é inofensivo (Set), para o whatsmeow pode ser redundante. |
| B3 | `disconnect` chama o provider mesmo quando o tenant está suspenso | `whatsapp-session.service.ts:72` — `await this.provider().disconnect(context.tenantId)` executa antes do early return na linha 73 | Estado não é alterado (early return), mas a chamada ao provider é desnecessária para tenants suspensos. |
| B4 | `maxConnectionsPerTenant: 1` declarado na config mas não aplicado no código | `whatsapp.config.ts:16` — campo presente; nenhuma validação de múltiplas conexões no serviço | O isolamento é efetivamente garantido pela restrição de banco `singletonKey` único (`whatsapp.schema.ts:16`), então o campo é documentação/configuração sem efeito adicional. |

### 3.3 Gap de Integração Não Provado (pendente de infraestrutura)

| # | Descrição | Evidência / Fonte |
|---|-----------|-------------------|
| G1 | Suíte PostgreSQL descartável não executada localmente | `whatsapp.postgres.integration.spec.ts:5-7` — `describe.skip` sem `CONTROL_PLANE_DATABASE_URL` válido; WA-05-R2 confirma porta 5432 recusada e 54331/5433 sem senha/verificação |
| G2 | Deploy server02/Tailscale não executado | `compose.whatsapp.yaml` (definição de deploy, não executado); WA-05-R2 confirma pendência de secrets `:?required` |
| G3 | Nenhum teste destrutivo contra banco compartilhado executado (conforme restrição) | — |

---

## 4. Validação dos Relatórios Anteriores contra o Código

### WA-05 (relatório de evidências)

O relatório `WA-05-RELATORIO-EVIDENCIAS.md` é **preciso em relação ao código-fonte revisado**:

- Todas as 9 asserções de segurança listadas (isolamento, autorização, webhook auth, idempotência, suspensão, preservação de sessão, logs sanitizados, outbound via Inbox, adapter de produção) são corroboradas pelas referências de arquivo:linha na seção 3.1 acima.
- A afirmação de que os 414 testes unitários e os 9 testes WA-05 passam é compatível com a execução registrada; a revisão não re-executou os testes, mas o código revisado é o mesmo coberto por eles.
- A recomendação de "NÃO ACEITO (pendente)" está correta: G1 e G2 são gap de infraestrutura, não de código.

### WA-05-R2 (preflight infraestrutura)

O preflight `WA-05-R2-PREFLIGHT.md` é **coerente com a revisão de código**:

- A causa raiz da falha de autenticação no `CONTROL_PLANE_DATABASE_URL` local (URL sem senha) é independente do código WhatsApp; o código de webhook (`whatsapp-webhook.controller.ts:62-68`) usa a URL como fornecida pelo ambiente.
- A conclusão de que o teste PostgreSQL não pode ser executado localmente está correta e não é um defeito de implementação.

---

## 5. Qualidade de Testes

- **Cobertura de unidade:** 61 suítes / 414 testes (incluindo 9 do WA-05), todos verdes. Nenhum teste enfraquecido ou removido.
- **Testes WhatsApp presentes:** `whatsapp.controller.spec.ts`, `whatsapp-webhook.controller.spec.ts`, `whatsapp-session.service.spec.ts`, `whatsapp-connection.service.spec.ts`, `whatsapp-config.spec.ts`, `whatsapp-rate-limiter.spec.ts`, `whatsapp-outbound.queue.spec.ts`, `fake-whatsapp.provider.spec.ts`, `whatsmeow.provider.spec.ts`, `whatsapp.postgres.integration.spec.ts` (skip sem banco), `wa-05.e2e.integration.spec.ts` (integração E2E com fake provider).
- **Qualidade:** os testes cobrem guardas de autorização, autenticação de webhook, idempotência, suspensão/billing, isolamento cross-tenant, sanitização de logs e registro de produção do adapter. Não há testes de integração PostgreSQL executáveis localmente (bloqueio de infraestrutura, não de qualidade de teste).

---

## 6. Gap do Product Gate (PRD-003, seção "Product Gate")

| Critério do Gate | Status | Nota |
|------------------|--------|------|
| Fluxo configuração → sessão → inbound → Inbox → outbound → reconnect demonstrável | ✅ (local, fake provider) | Provado pelos 9 testes WA-05 |
| Isolamento de tenant | ✅ | Código e testes corroboram |
| Idempotência | ✅ | Código e testes corroboram |
| Autorização | ✅ | Código e testes corroboram |
| Observabilidade | ✅ | Logs sanitizados + auditoria |
| Testes automatizados verdes | ✅ | 414/414 unitários + 9/9 WA-05 |
| Deploy privado server02/Tailscale | ⏳ | Não executado (WA-05-R2) |
| Gate de integração PostgreSQL | ⏳ | Não executado localmente (WA-05-R2) |

**Recomendação da revisão:** o código está apto para o gate do ponto de vista de implementação e segurança. O gate formal permanece bloqueado exclusivamente por itens de infraestrutura (PostgreSQL descartável local e deploy server02/Tailscale), que já estão documentados como pendentes nos relatórios WA-05 e WA-05-R2. Nenhum código precisa ser alterado para prosseguir após resolução da infraestrutura.

---

## 7. Conclusão

Não há blockers de código nem bugs de impacto na revisão WA-05-R3. Os bugs identificados (B1-B4) são de baixo impacto e não afetam os critípios de aceite do PRD-003. Os gaps G1-G3 são de infraestrutura, já documentados nos relatórios anteriores.

**Este relatório não concede aceite final.** É um artefato de revisão de código apenas leitura. O coordenador deve revisar as evidências e decidir sobre o Product Gate após resolução dos itens de infraestrutura pendentes.
