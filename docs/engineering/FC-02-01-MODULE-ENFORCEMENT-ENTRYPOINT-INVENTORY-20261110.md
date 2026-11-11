# FC-02.01 — Inventário de entradas sem ModuleAccessPort

**Data/base:** 2026-11-10, main ff879f45a5817bd829e28fa6414dbd19f687bf02.
**Estado:** auditoria estática concluída em código, NÃO migração operacional. Complementa WBS-FRONTEND-BACKEND-COMPOSITION-20261110.md e ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md.

## Veredito

CoreKernel.execute faz membership de tenant e OpenFGA por recurso. Ele NÃO verifica entitlement de módulo, status ENABLED, instalação, versão ou dependências. CoreKernel.executeModule acrescenta ModuleAccessPort, mas **nenhum controller/serviço/worker dos módulos em produção chama executeModule** no baseline auditado. A declaração de PgEffectiveModuleAccess no Host não basta.

Isso NÃO significa endpoints desprotegidos: CRM, Inbox, WhatsApp, Organizations e Support possuem autenticação, membership, guards e políticas de recursos específicas. Significa somente que desabilitar o módulo no Control Plane **não é, hoje, um interruptor efetivo para todas as operações de domínio**. Nenhum frontend pode afirmar o contrário.

As tabelas de catálogo/entitlement/install e ativação ainda estão ausentes no Control DB operacional, conforme pré-flight da AK-30.04. Introduzir fail-closed global sem provisionamento/cutover quebraria rotas atuais. Não fazer migração em lote nem declarar um gate ativo por ter integrado o seu código.

## Matriz de ingressos

| Fronteira/ingresso | Arquivo e recursos | Identidade e scope existentes | ModuleAccessPort hoje | Risco e ação |
| --- | --- | --- | --- | --- |
| CRM HTTP (pessoas/organizações/tags/notas/funcionários/canais/CSV) | modules/core-crm/src/crm.controller.ts, context-guard.ts, service.ts, extra.ts; /v1/tenants/:tenantId/crm/* | JWT via ActorVerifier, membership/FGA Kernel.execute, DefaultContextGuard com membership de Organization/Workspace e SQL 002 | **NÃO** | Aplicar gate moduleId crm ANTES de lease DB e do handler; preservar FGA por ação, contexto e resource grants |
| Inbox HTTP (conversas/mensagens/assignment/status/favorite/history/replies) | modules/inbox/src/inbox.controller.ts, context-guard.ts, service.ts; /v1/tenants/:tenantId/inbox/* | JWT, FGA inbox:conversations/..., org/workspace e SQL 002; verify scoped access no repositório | **NÃO** | moduleId inbox no ingresso, também em SSE, e gates adicionais de dependências ao chamar CRM/WhatsApp |
| Inbox SSE | modules/inbox/src/inbox.controller.ts GET /events; realtime.ts | Token de usuário, contexto Inbox, autorização de leitura antes de abrir stream | **NÃO** | Autorizar ENABLED ao abrir; definir fechamento/revalidação em revogação durante stream (não basta checar no subscribe) |
| WhatsApp HTTP (accounts, pair/connect/disconnect, contatos, grupos, avatares) | modules/whatsapp/src/http.ts; /v1/tenants/:tenantId/whatsapp/* | JWT, FGA whatsapp:accounts e Inbox/CRM para operações cruzadas, scope guard | **NÃO** | moduleId whatsapp; ações dependentes precisam conservar módulos CRM/Inbox também habilitados, sem criar grant por extensão |
| Platform Organization directory/context | modules/organizations/src/controller.ts, service.ts; /v1/tenants/:tenantId/platform/organizations* | JWT e CoreKernel.execute + membership SQL para org/workspace | **NÃO** | **Separar context foundation do módulo opcional.** Login/seleção de organização padrão não pode exigir pagamento de módulo Organizations que não integra dependências de CRM/Inbox |
| Advanced Organizations (bootstrap/backfill/criação de org/workspace/units) | modules/organizations/src/controller.ts e service.ts | JWT, FGA admin/role, validações SQL e trava SQL 002 | **NÃO** | Definir quais comandos são core bootstrap e quais recursos exigem entitlement organizations; não ativar multi-org |
| Workforce service | modules/organizations/src/workforce.ts | Serviço não montado como controller público; CoreKernel.execute + SQL membership por ação | **NÃO** | Manter não público; ao montar, exigir FGA e escopo explícitos, sem herdar Account Owner |
| Support HTTP | modules/support/src/controller.ts, service.ts; /v1/tenants/:tenantId/support/* | Token com client dedicado syndes-support-ui, tenant Syndes fixo e FGA de filas/recursos | **NÃO** | moduleId support, e checks de CRM/Inbox/WhatsApp por dependência; não conceder privilégio de Manager |
| WhatsApp inbound callback | modules/whatsapp/src/inbound-http.ts; POST /api/v1/internal/whatsapp/events/:tenantId | Token de webhook secret, validação de envelope, conta real service_enabled e tenant DB canônico | **NÃO** | Serviço técnico precisa de módulo ENABLED por tenant antes de persistir/projetar; validar identidade de service (não forjar usuário) |
| WhatsApp dispatch worker | modules/whatsapp/src/dispatch-worker.ts, dispatch.ts, outbound-relay.ts | Lista tenant_registry ativos, SQL account.service_enabled, vínculos de organização e idempotência outbox | **NÃO** | Gate efetivo para whatsapp + inbox/crm antes de cada lease/dispatch, sem perder outbox durável; suspender tem de interromper novas entregas |
| Whatsmeow Go gateway | modules/whatsapp/gateway/whatsmeow/{gateway.go,main.go,outbound.go} | Token interno/HMAC, contas enabled no gateway, tabela própria de outbox, callback com Bearer service token | **Sem integração Control Plane** | Pausar session/dispatch no gateway na revogação; não assumir que mudança no Control DB cancela mensagens já entregues à fila Go |
| Host authorizer genérico | apps/core-host/src/main.ts, POST /v1/tenants/:tenantId/authorize | JWT, membership e FGA kernel.execute | **NÃO** | Diferenciar check genérico de contexto platform dos recursos específicos; não responder "módulo habilitado" a partir desse check |
| Assets CRM legados | modules/core-crm/src/plugin.ts + apps/core-host/src/module-host.ts; GET /crm e seus assets empacotados | Assets servidos por middleware de rotas confiáveis, antes da autorização de dados | **Não aplicável a estáticos** | Inventariar consumidores e CSP; **APIs chamadas por assets** continuam exigindo executeModule. Não usar asset availability como autorização |
| Manager inventory | apps/master-admin-api/src/modules/tenant-module-inventory.mjs | Operador global + Control DB leitura de metadados | **Não é Tenant Plane** | Não compartilhar token/consulta do Manager com Workspace; leitura de estado administrativo não autoriza negócio |

## Dependências já declaradas nos plugins (manifest compilado)

- CRM: platform
- Inbox: platform + CRM
- WhatsApp: platform + CRM + Inbox
- Organizations: platform
- Support: platform + CRM + Inbox + WhatsApp + Organizations

**Decisão necessária antes de FC-02.02:** Organizations é domínio parcialmente misto: o diretório/contexto padrão é infraestrutura mínima sempre necessária, enquanto criação de múltiplas organizações e gestão avançada podem ser uma funcionalidade opcional. A dependência de Support em Organizations não cria obrigação de entitlement Organizations para CRM/Inbox. Não vincular a navegação de Account/Workspace a uma licença de Organizations de forma circular.

## Proposta de migração segura (não implementada)

1. Em staging descartável, implantar Control DB versionado, releases aprovadas, entitlements, registros INSTALL/ENABLE, roles mínimas e dois tenants A/B de fixture. Só depois habilitar qualquer check runtime. Testar backup/restore real antes de ambientes persistentes.
2. Criar helper/decorator de entrada **mínimo** no Host que usa CoreKernel.executeModule depois de JWT e antes de resolver tenant DB. A política de acesso ainda é por recurso/ação FGA; moduleId vem de código confiável (nunca de request).
3. Migrar CRM guard central e testes de leitura/escrita, wrong tenant, entitlement expirado, suspensão, release inválida, Control DB indisponível, sem redefinir o token. A migração deve ser sem mudança do formato das APIs.
4. Migrar Inbox guard e SSE; testar revogação durante conexão aberta e operações combinadas CRM/WhatsApp. Não permitir persistência de stream quando módulo ou tenant foram suspensos.
5. Migrar WhatsApp HTTP, callback interno e dispatch worker com identidade de serviço e rate-limit/acks coerentes. Validar outbox/receipt, backlog, idempotency, retry e comando de pausa do Go gateway; não apagar dados nem reportar evento enviado se não confirmado.
6. Migrar Support em seu client e tenant exclusivos, incluindo dependências e filas; separar autenticação Support da autenticação Manager.
7. Separar endpoints de context foundation (platform organizations/workspaces default) dos comandos administrativos opcionais; manter SQL 002 até aprovar Gate #31 e compatibilidade de múltiplas organizações.
8. Criar read model tenant-safe para frontend a partir de uma fonte **operacional** de módulos autorizados, distinct do inventário do Manager; só então filtrar navegação de UI. Não há acesso automático para Account Owner.

## Gates verificáveis para FC-02.02/03

- Rota HTTP **direta** de módulo desabilitado retorna 403 (ou 503 indisponível de infraestrutura) independentemente de feature escondida, FGA stale ou antigo asset acessível.
- Operação autorizada em tenant A habilitado funciona, B sem entitlement é negado; Control DB sem tabelas/indisponível nega; tenant/organization/workspace trocados são recusados.
- Revogação interrompe SSE/worker/gateway sem perda silenciosa de outbox; backlog preservado para recuperação aprovada.
- Regressões CRM/Inbox/WhatsApp/Go/Support passam; contratos JWT, Keycloak, OpenFGA e OpenBao reais são testados em ambiente descartável. Sem ativar SQL 002/multi-org ou alterar CI delegada.
- Sem DDL em banco operacional antes de backup e restore, grants técnicos segregados e janela autorizada.

## Observações sobre método

Inventário feito por busca de @Controller, Kernel.execute/executeModule e fontes de worker em modules/* e Core Host. É **auditoria estática**, não prova de ausência de outros caminhos dinâmicos, CRON externo, n8n ou consumidores sem cobertura. FC-02.02 deve ampliar a matriz com métricas/trace, E2E real e testes negativos. Não transformar hipótese de risco em afirmação de vazamento real.
