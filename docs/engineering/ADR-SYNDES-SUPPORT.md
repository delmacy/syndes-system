# ADR — Isolamento do Syndes Support
Status: PROPOSTO, branch `feat/syndes-support-20261109`; origem PR #27 HEAD `8e2fb5d`.

## Contexto validado
A `main` é governança, não código operacional completo. A implementação funcional mora em `integration/workspace-org-crm-c2-20261109` (#27, draft), com `CoreKernel.execute`, `TrustedTenantDatabaseProvider`, módulos instalados, Keycloak, OpenFGA, PostgreSQL por tenant, Inbox escopada, CRM, Whatsmeow e SQL 002 (trava). #21 foi fechada como código; #31 continua gate de produção.

## Decisão
Adicionar `@syndes/core-support` como módulo Nest do Host modular; **nenhuma segunda infraestrutura de helpdesk**. Os tickets vivem somente no banco do tenant operacional Syndes. A identidade desse tenant é **configuração de servidor** `SYNDES_SUPPORT_TENANT_ID` (UUID válida; fail-closed se ausente), comparada com o tenant roteado antes de qualquer pool/consulta. Nenhum tenant comum recebe serviço por configuração implícita. `SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID` (UUID) define a conta externa exclusivamente Syndes, obrigatória para vincular conversas, sem ler bases comerciais.

Request HTTP -> verificar Keycloak -> comparar tenant Syndes -> CoreKernel (membership + FGA por tipo e operação) -> TenantDB confiável -> SQL com verificação do solicitante/filas e tipo -> auditoria transacional. `support:cases:internal` e `support:cases:external` são recursos FGA distintos. A autorização FGA do recurso **não substitui** a autorização SQL por fila/solicitante.

## Modelo
- `support_queues`: filas fixas com tipo, criadas na migration 001, `external/general` e quatro `internal/*`.
- `support_queue_memberships`: operador autenticado + fila + role (agent/lead), sem concessões iniciais; gerenciadas por procedimento operacional com trilha.
- `support_cases`: tenant, id, protocol, kind, channel, requester_id, crm_person_id, inbox_conversation_id, commercial_tenant_ref (nullable), queue_code, assigned_to, priority, status, timestamps.
- `support_case_events`: id, ticket, actor, action, estado anterior/novo, detalhe interno, timestamp; somente banco do tenant Syndes. Auditoria atômica com mutação.
- Conversa externa deve provar escopo do tenant Sydnes, conta WhatsApp dedicada, canal e vínculo com CRM interno. Uma conversa não cria tickets em tenants comerciais.
- Protocolo sequencial não entra em endpoints públicos nem implica permission.

## Segurança e fluxos negados
1. Tenant divergente falha antes de `TenantDatabaseProvider.resolve`.
2. Master admin não recebe acesso a mensagens só porque é admin. Não há autenticação compartilhada nem grants automáticos.
3. Caso externo nunca é visível a usuário de ticket interno. Caso interno é visível ao próprio solicitante (leitura) ou membro da fila; mutações de atendimento só para membros da fila.
4. Para agente atuar, exigir associação ativa à fila no SQL mesmo que Keycloak/FGA concedam leitura ampla. Sem membros de fila, nenhuma operação de atendente.
5. Leitura e mutação sempre filtram `tenant_id` e `kind` com autorização de fila na consulta antes de LIMIT/OFFSET. Não há SSE do Support no P0; reutilização futura requer stream dedicado e teste negativo.
6. História/nota nunca passa por Inbox outgoing; inbox messages internal ficam sob a política já existente.
7. `SYNDES_MULTI_ORG_ENABLED` e SQL 002 permanecem intactos. Sem novo controle de acesso entre orgs nesta entrega; a operação é tenant Syndes único e em contexto já validado.

## Dependências
`core-kernel`, Core Host, `organizations` (context), CRM, Inbox, Whatsmeow. Migração suporte depende de tabelas CRM/Inbox/WhatsApp existentes; installer listado via plugin. Configuração de Keycloak/OpenFGA e grants feita por operação autorizada fora deste PR.

## Alternativas recusadas
Usar banco central Control Plane (vaza conteúdo operacional), anexar tickets no banco do cliente (violaria fronteira), criar Jira/Chatwoot (duplicação), conceder admin global (privilégio excessivo), apenas esconder filas por UI (inseguro).

## Release/rollback
Migration 001 aditiva, sem `DROP`/alteração de dados atuais. Desativar módulo manifest ou retirar rota após rollback do Host, **não** reverter SQL com dados; preservar trilha. Restore ensaiado em PostgreSQL descartável antes de autorizar instalação no tenant Syndes. `main` e #27 não são alteradas.

## Proteção do instalador multi-tenant (revisão posterior ao PR inicial)
O Core Host monta os plugins globalmente, inclusive Support, e o instalador genérico percorre todas as migrações. Por isso a fronteira de dados não pode depender da negação HTTP. `infra/postgres/bootstrap/migrate-modules-tenant.sh` agora carrega a função testada `syndes_module_migration_allowed`, que **omite** a migração `support/*` salvo quando `TENANT_ID` coincide com `SYNDES_SUPPORT_TENANT_ID` válida e explicitamente configurada. Outros módulos continuam sendo migrados normalmente. Nenhuma tabela Support deve ser criada nos bancos comerciais durante a instalação padrão. Testes negativos: `tests/platform/support-migration-gate.test.sh`. A configuração da identidade do tenant permanece uma aprovação operacional — não uma variável escolhida pelo navegador.
