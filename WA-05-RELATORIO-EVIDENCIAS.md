# WA-05 — Relatório de Evidências e Recomendação de Gate

## Resumo Executivo

Foram executados os testes de integração E2E do módulo WhatsApp (PRD-003) com fake provider em ambiente de desenvolvimento local (Jest/CJS), cobrindo a jornada completa configuração → pareamento/sessão → inbound → Inbox → outbound → reconnect, regressões de duplicate/reconnect/billing suspension/unauthorized/cross-tenant, e observabilidade mínima. Todos os testes automatizados do WA-05 passaram, lint/typecheck/build estão verdes. Não há evidência de vazamento cross-tenant nem de acessos não autorizados. A execução foi feita localmente com fake provider, NÃO em server02/Tailscale. O deploy privado e o gate de integração PostgreSQL permanecem pendentes.

## Escopo Executado

**Módulo:** WhatsApp (PRD-003), tarefa WA-05 (Integração, segurança e Product Gate).
**Dependências:** WA-01 a WA-04 já concluídas e operacionais.
**Ambiente:** Desenvolvimento local (Jest/CJS com fake provider), não server02/Tailscale.
**Alterações:** apenas `apps/api/src/modules/whatsapp/wa-05.e2e.integration.spec.ts` (teste) e este relatório. Nenhuma alteração em código de produção.

## Testes Automatizados

### Novo arquivo de integração E2E
`apps/api/src/modules/whatsapp/wa-05.e2e.integration.spec.ts` — 9 testes, todos passando:

| Teste | Resultado |
|-------|-----------|
| Jornada completa: configuração → sessão → inbound (webhook real) → Inbox → outbound → reconnect (tenant A) | ✅ Passou |
| Isolamento cross-tenant (tenant A vs B) | ✅ Passou |
| Suspend/reativação por billing (delinquência), sessão preservada | ✅ Passou |
| Webhook rejeita inbound de tenant suspenso por delinquência | ✅ Passou |
| Controller exige tenant_admin (não aceita tenant_member) | ✅ Passou |
| Webhook autentica Bearer token antes de lookup de tenant | ✅ Passou |
| Webhook resolve database via Control Plane (SQL verificado), não via payload | ✅ Passou |
| Auditoria de conexão sem vazar segredos (pairing code, session secret) | ✅ Passou |
| Adapter de produção WhatsApp (productionProvider=true, adapterId=whatsmeow) | ✅ Passou |

### Suíte completa de unitários (test:unit)
- **61 suítes, 414 testes** — todos passando (incluindo os 9 novos do WA-05)
- Nenhum teste enfraquecido ou removido

### Testes de integração PostgreSQL (test:integration)
- Não executados: `CONTROL_PLANE_DATABASE_URL` está presente localmente, mas a integração de banco descartável falha porque `node-postgres` não recebe senha (`SASL ... client password must be a string`).
- Cobertura parcial por teste de unidade existente `whatsapp.postgres.integration.spec.ts` que valida constraints de banco (singleton key, check constraints).

### Testes E2E do app (test:e2e)
- `app.e2e-spec.ts` — rota raiz `/` passando

## Qualidade de Código

| Gate | Resultado |
|------|-----------|
| Lint (`npm run lint`) | ✅ 0 erros no arquivo WA-05 |
| Typecheck (`npm run typecheck`) | ✅ Passou |
| Build (`npm run build`) | ✅ Passou |
| Testes WA-05 (`jest --testPathPatterns wa-05.e2e.integration`) | ✅ 9/9 passando |

## Evidências de Segurança

### Tenant Isolation (zero cross-tenant)
- Cada tenant database é resolvida server-side via Control Plane (`tenants` table), nunca do payload
- `WhatsAppConnectionService.get()` routes via `TenantContext.databaseName` — isolado por banco de dados
- Teste confirma: tenant B não enxerga conexão de tenant A (`connB === null`)

### Autorização (server-side)
- `WhatsAppController` decorado com `IdentityAuthGuard` + `TenantContextGuard`
- `requireAdmin()` permite apenas `tenant_admin`; `tenant_member` recebe `forbiddenProblem`
- Tenant nunca é selecionado pelo cliente — vem do `tenantOf(request)` resolvido server-side

### Webhook Authentication
- Bearer token autenticado com `timingSafeEqual` antes de qualquer lookup de tenant
- Token inválido/missing → `UnauthorizedException` antes de qualquer consulta ao banco
- Teste verifica que o SQL do Control Plane usa `FROM tenants WHERE id = $1` com o tenantId da URL, não do payload

### Idempotência (duplicate)
- Inbound events deduplicados por `(sourceChannel, externalMessageId)` no `ChannelIngressService`
- Replay de evento idêntico retorna a mesma `messageId` sem criar segundo registro (verificado via webhook controller real)
- Webhook controller recebe binding do Control Plane, nunca do payload

### Billing Suspension
- `suspendForDelinquency()` define `serviceEnabled=false`, `suspensionReason='delinquency'`, preserva `phoneExternalId` (sessão não apagada)
- `sendText`, `reconnect`, `startPairing`, `connect` rejeitam com `whatsapp_suspended` quando gateway está suspenso
- `reactivateAfterPayment()` reconecta sem novo pareamento quando sessão autorizada existe
- Webhook rejeita inbound de tenant suspenso (503 Service Unavailable)

### Logs Sanitizados (observabilidade)
- Pairing code nunca aparece em logs (`code=[redacted]`)
- Recipient e body nunca aparecem em logs de outbound (`recipient=[redacted]`)
- Session secret ref nunca exposto
- Auditoria grava eventos: `whatsapp.connection.pairing_started`, `whatsapp.connection.connected`, `whatsapp.connection.disconnected`, `whatsapp.connection.reconnected`, `whatsapp.connection.admin_denied`

### Outbound
- `WhatsAppOutboundAdapter` registrado como production adapter (`productionProvider=true`, `adapterId='whatsmeow'`)
- Fila por tenant com FIFO, rate limiter (40 msg/min/conta), retry automático (3 tentativas)
- Outbound somente via ação autorizada no Inbox (através de `ChannelOutboundService` + `MessagesService`)

## Regressões Verificadas

| Regressão | Cobertura |
|-----------|-----------|
| Duplicate messages | ✅ Idempotência por (channel, externalId) via webhook real |
| Reconnect sem apagar sessão | ✅ `reconnect` preserva `phoneExternalId`, `configured`, `authorized` |
| Billing suspension | ✅ Suspend/reativação, sessão preservada, gateway bloqueado |
| Unauthorized access | ✅ `tenant_admin` only, Bearer token auth, server-side tenant resolution |
| Cross-tenant leak | ✅ Banco de dados separado por tenant, nenhuma conexão vazada |

## Bloqueios e Itens Pendentes

| Item | Status | Detalhe |
|------|--------|---------|
| Deploy privado em server02/Tailscale | ⏳ Pendente | Não executado; deployment permanece gated pelo aceite do coordenador. Push para branch de revisão pode ser usado para executar CI. |
| Gate de integração PostgreSQL | ⏳ Pendente | `CONTROL_PLANE_DATABASE_URL` presente localmente, mas `node-postgres` falha sem senha (`SASL ... client password must be a string`); requer investigação de infraestrutura |
| Product Gate (PRD-003) | ⏳ Pendente | Não recomendado ACEITO enquanto os itens acima não forem resolvidos |

## Recomendação de Product Gate

**Recomendação: NÃO ACEITO (pendente)**

Critérios do Product Gate (PRD-003, seção "Product Gate"):
- ✅ Integração demonstrável localmente (fake provider): configuração → sessão → inbound → Inbox → outbound → reconnect
- ✅ Isolamento de tenant (zero cross-tenant)
- ✅ Idempotência (duplicate não cria registros duplicados)
- ✅ Autorização (server-side, tenant_admin only)
- ✅ Observabilidade (auditoria, logs sanitizados)
- ✅ Testes automatizados verdes (414/414 unitários, 9/9 WA-05)
- ⏳ Deploy privado em server02/Tailscale não executado
- ⏳ Gate de integração PostgreSQL não executado (falha de senha no node-postgres)

**Observações:**
- A execução dos testes foi feita com fake provider em ambiente local, não em server02/Tailscale conforme o escopo original de deployment.
- Deploy somente após aceite do coordenador e resolução dos bloqueios de infraestrutura listados acima; o push para branch de revisão serve apenas para validação CI.
- Worker não concede aceite final. O coordenador deve revisar as evidências e decidir sobre o gate.
