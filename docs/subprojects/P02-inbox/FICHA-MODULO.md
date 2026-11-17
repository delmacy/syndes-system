# P02 Inbox — Ficha Mestre de Módulo (v1.0.0)

> **Instância do template congelado v1.0.0 · 16/11/2026.** Baseline de inspeção `24018b354392196899332af1581170fb3ad7cf24`. **Documentação reconcilia código, não implementa novas funcionalidades.** Auditoria local anterior em 12/11: 34 PASS no checkout `b452a03e` (não reexecutados aqui). Integração operacional com IAM, workers, migrations aplicadas, UI e Product Gate: **NÃO HOMOLOGADOS**.

## 00 · Identidade, escopo e evidência

| Campo | Estado documentado |
|---|---|
| Unidade, owner | **P02 Inbox**, `modules/inbox`, conforme catálogo |
| Package | `@syndes/core-inbox` v0.1.0, TypeScript, plugin NestJS |
| Propósito | Conversas, fila, mensagens, notas, atribuição, handoff e integrações por contrato |
| Código identificado | **17 endpoints** HTTP e **2 consumidores** versionados |
| Ações/documentos | **19 fichas A–J** em [MATRIZ](MATRIZ-ACOES.md) |
| Banco | **3 tabelas base** em `sql/001_inbox_foundation.sql` no Tenant DB |
| Escopo normativo | [ESCOPO](ESCOPO.md) permanece **RASCUNHO NÃO APROVADO** |
| Testes | 34 PASS **históricos 12/11**; não reexecutados na reconciliação |
| Produção e aceite | **NÃO HOMOLOGADOS**; grants, SQL 002, Keycloak e cutover pendentes |
| Template | [Modelo Mestre v1.0.0](../../standards/TEMPLATE-FICHA-MODULO.md), **inalterado** |

## 01 · Fontes canônicas, leitura e documentação

[README](README.md), [ESCOPO](ESCOPO.md) e capítulos, [REFERÊNCIA TÉCNICA](REFERENCIA-TECNICA.md), [INVENTÁRIO TÉCNICO](INVENTARIO-TECNICO.md), [MATRIZ DAS AÇÕES](MATRIZ-ACOES.md), [DIAGRAMAS](DIAGRAMAS.md), [STATUS](STATUS.md), [EVOLUÇÃO](EVOLUCAO.md), [OPERAÇÃO](OPERACAO.md), [SPRINT](SPRINT.md), [HISTÓRICO](HISTORICO.md), `AGENTS.md` global e `modules/inbox/AGENTS.md`. Fonte executável em `modules/inbox/src`, `sql`, `test`, `apps/workspace-web/src/features/inbox.tsx`; fonte do owner prevalece sobre narrativa.

## 02 · Missão, atores, histórias e casos de uso

**Missão:** receber/organizar conversas, permitir que operador autorizado acompanhe a fila, consulte histórico, assuma, responda e registre notas, sem assumir os contratos de CRM, WhatsApp ou protocolo/funil P05.

**Atores:** operador autorizado por tenant/organization/workspace, administrador de tenant com grants concretos, serviço autenticado para eventos. **Manager global não tem bypass implícito.**

**UC-01 descritivo:** buscar fila → abrir conversa → consultar mensagens → assumir ou liberar → responder/anotar → marcar estado. **UC-02:** inbound WhatsApp versionado → consumidor P02 persistido → participante observado → política CRM resolve/revisa → vínculo conservador P02. **UC-03:** transferência entre workspaces da mesma organização sob permissão específica. Todos os casos são **descrições do código**, não novas histórias aprovadas.

## 03 · Funções e ações detalhadas

| Função | Fichas das ações de código |
|---|---|
| Fila e indicadores | [Filtrar fila e pesquisar conversas](acoes/p02-queue-list.md) · [Consultar indicadores da fila](acoes/p02-queue-metrics.md) |
| Conversas | [Criar conversa de demonstração](acoes/p02-conversation-create.md) · [Consultar conversa](acoes/p02-conversation-get.md) · [Alterar estado da conversa](acoes/p02-conversation-status.md) · [Marcar ou desmarcar favorito](acoes/p02-conversation-favorite.md) · [Marcar conversa como lida](acoes/p02-conversation-read.md) |
| Mensagens e notas | [Consultar mensagens](acoes/p02-message-list.md) · [Responder à conversa](acoes/p02-message-reply.md) · [Registrar nota interna](acoes/p02-message-note.md) |
| Operação do atendimento | [Atribuir ou liberar responsável](acoes/p02-assignment-set.md) · [Alternar atendimento humano ou bot](acoes/p02-handoff-set.md) · [Transferir conversa entre workspaces](acoes/p02-workspace-transfer.md) |
| Vínculo CRM | [Vincular conversa à pessoa CRM](acoes/p02-crm-link.md) · [Consumir resolução de pessoa CRM](acoes/p02-crm-resolved-event.md) |
| Canais e eventos | [Solicitar histórico WhatsApp](acoes/p02-whatsapp-history.md) · [Simular mensagem de entrada](acoes/p02-simulation-inbound.md) · [Consumir evento WhatsApp recebido](acoes/p02-whatsapp-ingest-event.md) |
| Tempo real | [Acompanhar alterações por SSE](acoes/p02-realtime-events.md) |

[Índice navegável com as 19 fichas](MATRIZ-ACOES.md); [portal de ações](https://delmacy.github.io/syndes-system/modulos/inbox/acoes/). Nem toda ação possui endpoint: duas são consumidoras de eventos assíncronos.

## 04 · Arquitetura e diagramas

[DIAGRAMAS.md](DIAGRAMAS.md) representa C4 simplificado, sequência de atendimento, fluxo WA–CRM, boundary JWT/FGA e ERD das três tabelas base. Backend: Core Host carrega o pacote trusted `@syndes/core-inbox/plugin`; o `InboxHost` recebe runtime, tenant DB provider e `InboxChangeBus`. `InboxDefaultContextGuard` resolve escopo; `InboxService` aplica Kernel e `PgInboxRepository` persiste somente no banco correto. **Diagrama não significa Host montado/serviço ativo no ambiente.**

## 05 · Stack, símbolos e exports

TypeScript 5.9, Node, NestJS (peer dependency), PostgreSQL no Tenant DB e Core Kernel. Exports oficiais do pacote são `.` (`src/index.ts`) e `./plugin` (`src/plugin.ts`), não todas as classes internas. Símbolos: `InboxService`, `InboxHost`, `InboxController`, `PgInboxRepository`, `PgInboxRepositoryFactory`, `InboxDefaultContextGuard`, `InboxChangeBus`, `InboxWhatsAppReceivedConsumer`, `InboxCrmPersonResolvedConsumer`. [Inventário de métodos e ownership](INVENTARIO-TECNICO.md). `modules/inbox/public/` é UI legada; Workspace A01 é consumidor frontend contemporâneo.

## 06 · Contratos HTTP, erros e recursos

17 decorators `GET|POST|PATCH` em `src/inbox.controller.ts`, base `/v1/tenants/:tenantId/inbox`. Inclui fila `status/queue/scope/q/offset/limit`, conversa, mensagens, status, favorite, read, handoff, assignment, transferência workspace, vínculo CRM, histórico WhatsApp, reply, notes, simulation, metrics e stream `events`. [Matriz de contratos](MATRIZ-ACOES.md) traz as 17 rotas por ação. Controller traduz autenticação inválida para 401, falta de permissão para 403, input inválido 400, conflito 409 e DB mismatch/infra 503; 404 depende de método. A existência do decorator não prova rota publicada em Host real.

## 07 · Dados, tabelas, migrations e integridade

**Paridade verificada nos arquivos:** [migrations por owner e campos](PARIDADE-CODIGO.md); P02 SQL 001, P04 SQL 002/003 e P03 SQL 005. O Host pode exigir também stages posteriores de ownership e outbox. **A ordem de deploy e a aplicação real continuam pendentes.**


A migration 001 é base do **Tenant DB**: `inbox_conversations` (PK `tenant_id,id`, FK qualificada para `crm_people`), `inbox_messages` (FK qualificada para `inbox_conversations`) e `inbox_events` (auditoria de mutações). Índices base de fila, dedup de external thread/message e histórico. Extensões como `platform_organization_id`, `platform_origin_workspace_id`, `platform_current_workspace_id`, `unread_count`, `is_group`, `is_favorite`, `source`, `bot_eligible`, `provider_message_id` aparecem nas queries atuais, **mas não na SQL 001**. É necessária rastreabilidade e verificação dos upgrades de outros owners e SQL 002; não afirmar migrations aplicadas. Nenhuma tabela própria do Inbox no Control DB.

## 08 · Eventos, outbox e realtime

**C06 Platform Events**, condicionado a worker opt-in: `whatsapp.message.received.v2` aciona `InboxWhatsAppReceivedConsumer`, cria/acha conversa e mensagem idempotentes em transação tenant e pode publicar `inbox.participant.observed.v1`. `crm.person.resolved.v1` chega ao `InboxCrmPersonResolvedConsumer`, que revalida política e não sobrescreve Person diferente. **SSE `InboxChangeBus` não é Event Bus persistente**: stream `changed` sem PII, 60 conexões no objeto, expiração em 60s, revalidação a cada 5s em modo `enforce`, reconsulta REST no frontend; apenas memória de um Host.

## 09 · Segurança, identidade e isolamento

**Incremento P02-ASSIGN-01:** o destinatário da atribuição agora é validado na mesma instrução SQL da escrita, exigindo `platform_org_memberships` e `platform_workspace_memberships` ativas (`admin/editor`) na organização e workspace atuais, ambos ativos; `viewer` não pode receber nova conversa. O ator mantém autorização `inbox:assignment/write`. Falha de elegibilidade retorna 404 genérico e `null` continua liberando atribuição. **Não há grant FGA ao destinatário; não há saneamento retroativo de atribuições anteriores.** Necessita migrations P04 e backfill antes de ativação.


O Host verifica JWT Keycloak; `InboxDefaultContextGuard` valida membership de tenant + FGA `inbox:conversations/read` **antes da seleção do banco**, e resolve organização/workspace padrão ou seleção validada; `CoreKernel.execute` aplica recurso/método. Em `inboxModuleGateMode=enforce`, `executeModule` adiciona o gate ENABLED. `SYNDES_MULTI_ORG_ENABLED=true` exige seleção explícita, mas **não indica rollout aprovado**. FGA por recursos `inbox:conversations`, `messages`, `notes`, `assignment`, `simulation`, `metrics`, com grants adicionais `crm:people/read` e `whatsapp:accounts/read` quando aplicáveis. SSE isola por tenant/org/workspace. [Matriz de segurança](MATRIZ-ACOES.md); negações A/B reais ainda abertas.

## 10 · Frontend e experiência de atendimento

Workspace `apps/workspace-web/src/features/inbox.tsx` contém lista lateral, filtros Telefones/Grupos, fila, busca, histórico, contato, composer resposta/nota/simulação, estados, atribuição, handoff, favoritos, não lidas e integração visual com CRM e Inspector P05. `modules/inbox/public` contém assets legados. **Não confundir** UI do Inbox autenticado com leitor de documentação Next.js. Estados de UI e contratos podem divergir; comparar clientes HTTP e resposta decorada. E2E real mobile/browser com Keycloak/FGA ainda não comprovado neste recorte.

## 11 · Infraestrutura, instalação e configurações

Instalação como plugin confiável no Core Host; depende de módulos `platform` e `crm`. Há provider de Tenant DB confiável, OIDC client público `syndes-inbox-ui` para UI legada e ports opcionais WhatsApp. **Código no repo não instala automaticamente** plugin, workers, OIDC client, grants FGA ou migrations. Modo `legacy|enforce`, backfill Stage B, índices SQL 002 e multi-org requerem pré-flight, restore e aprovação por ambiente. Configuração/secrets nunca devem estar nas fichas.

## 12 · Operação, observabilidade e recuperação

[OPERACAO.md](OPERACAO.md) é índice, não runbook homologado. `GET metrics` mostra contadores do domínio; `InboxChangeBus` é invalidação efêmera, não broker distribuído. Observabilidade, logs sem PII, tracing, SLI/SLO, dashboards, backup/restore, rollback, limites de instância e alta disponibilidade: **NÃO COMPROVADOS**. Evitar habilitar réplica adicional sem estratégia SSE compartilhada e recuperar snapshot via API após reconexão.

## 13 · Testes, negativos e evidências

**Pré-homologação P02-ASSIGN-02:** [plano e cenários](PRE-HOMOLOGACAO-ASSIGN.md). CI com PG17 descartável para classificar assigned_to legados e validar migrações/recibo P04, além de OpenFGA em memória real para checar grant individual separado da membership. **Os testes não aplicam a verificação individual FGA no P02**, nem corrigem atribuições antigas, nem testam Keycloak real. O [Actions run 43968388949](https://github.com/delmacy/syndes-system/actions/runs/43968388949), SHA `df6424c`, confirmou preflight PG 1 PASS e OpenFGA descartável 5 PASS, sem provar IAM/tenant reais.


**P02-ASSIGN-01:** foram adicionados casos PostgreSQL descartável (vínculo ativo, viewer, revogado, estrangeiro, organização/workspace arquivados, liberar, idempotência e audit) e teste específico de paralelismo/revogação com duas sessões e HTTP do Core Host com verifier/FGA de teste; resultados verificados no job `Regression / inbox` do [run 43939884169](https://github.com/delmacy/syndes-system/actions/runs/43939884169), commit `8de743e`: 35 PASS unitários, 1 isolamento PG, 1 persistência PG, 1 concorrência PG e 9 HTTP do Host. **Sem homologação Keycloak/OpenFGA reais.**


Auditoria histórica de 12/11 `b452a03e`: **34 PASS locais** em `cd modules/inbox && npm test`; não reexecutados na documentação P02. Arquivos existentes `inbox.test.mjs`, `default-context.test.mjs`, `scope-query.test.mjs`, `frontend.test.mjs`, `realtime.test.mjs`, `pg-integration.mjs`, `pg-org-scope.mjs`, `postgres-integration.sh`. Suítes browserless DOM e PostgreSQL descartável não comprovam sessão real, worker/cutover, browser com layout ou restore em alvo. Cada uma das [19 fichas](MATRIZ-ACOES.md) tem cenários Given/When/Then **propostos**.

## 14 · Requisitos não funcionais

Texto validado, máximo 5000 caracteres no corpo de mensagem/nota; `subject` até 160; `externalThreadId` até 160. Fila suporta `limit` entre 1–100, `offset` até 100000, `q` até 80, `queue=all|mine|unassigned` e `scope=all|unread|favorites|groups|archived`. SSE: 60 ouvintes configurados por canal, stream 60s e revalidação no `enforce`. Metas de latência, SLA, throughput, retenção LGPD e UX acessível medida: **PENDENTES**, não inventar números.

## 15 · Dependências e mapa de impacto

| Owner | Contrato / fronteira |
|---|---|
| A04 Core Host/A08 Kernel | OIDC, tenant provider, plugin, authorize e Module Gate |
| C01 Control/P04 Organizations & Workforce | tenant, org/workspace, memberships e atribuições |
| C03 Keycloak/C04 OpenFGA | AuthN, AuthZ e grants |
| P01 CRM | Person canônica e política de vínculo |
| P03 WhatsApp/I09 Gateway | conta, canal, entrega, histórico e rotas |
| C06 Event Bus | transação, outbox, dispatcher, consumer opt-in |
| A01 Workspace | UI; contratos e API com escopo |
| P05 Gestão de Atendimentos | funil, protocolo, etapas, Inspector sob dupla autorização |

Modificar payload, migration, FGA, port ou contrato exige revisão de consumidores e owner. Não editar internals externos a P02 por conveniência.

## 16 · WBS, entregáveis e prioridades

[EVOLUÇÃO](EVOLUCAO.md) contém WBS WP-50: 50.01 paridade, **50.03 homologação Inbox**, 50.04 layout/contato, 50.08 aceite integrado; WP-55.05 Inspector P05, com ownership externo. Estados são históricos; nenhuma task passa a DONE por esta ficha. Primeiro reconciliação documental, depois testes Keycloak/FGA + Tenant A/B, depois worker WA/CRM com replay, depois UI e restore. **P02-VAL-01 é candidato, não tarefa atribuída.**

## 17 · Decisões, riscos e pendências

**Diferenças comprovadas para decisão futura:** [PARIDADE-CODIGO.md](PARIDADE-CODIGO.md). O PATCH CRM manual permite substituir Person; consumer CRM automático rejeita divergência. `markRead` não grava evento de auditoria; `favorite` grava até em repetição. **A lacuna de membership para novas atribuições foi tratada em P02-ASSIGN-01; permanecem pendentes** a definição de papel especializado, grants individuais do destinatário e a revisão de registros antigos. Não declarar Product Gate concluído.


**Sem decisões novas aprovadas.** P0: mapear migrations 002/alterações de canais antes de ativar; resolver grant/membership e gates; provar entrega outbound WhatsApp; evitar duas projeções concorrentes do mesmo evento; controlar idempotência/duplicados; determinar fallback e broker SSE para mais de um Host. P1: fluxos de operador, responsividade e UX com dados reais; regra explícita para transferências entre workspaces; vínculo CRM com dados ambíguos. Não inferir permissões de badges de UI nem homologação de testes simulados.

## 18 · Handoff ao agente e prompts

Entrada recomendada: `P02 + actionId + decisão/observação + SHA`. Ler a [ação](MATRIZ-ACOES.md), `AGENTS.md`, ESCOPO, STATUS, contratos públicos, source e testes. Planejamento: mapear impacto, perigos, critérios e WBS **sem alterar runtime**. Implementação: somente autorização específica, alterar paths do owner, aplicar testes com mocks e integrações reais quando aprovados, reconciliar docs/status/diagramas e registrar SHA. Nunca exigir acesso secreto à produção para preencher uma ficha.

## 19 · Checklist código × documento × ambiente

1. Confirmar branch/SHA, requisito aprovado e actionId, owners e paths autorizados.
2. Verificar export público, decorator/método, FGA, tenant/org/workspace, SQL e migrations.
3. Cobrir happy path, erros, duplicação, replay, concorrência, desconexão SSE e negações A/B.
4. Implementar somente o autorizado, testar com resultados PASS/FAIL/SKIP e ambiente.
5. Atualizar ação A–J, Ficha Mestre, matriz, diagramas, STATUS, WBS e consumidores.
6. Distinguir **commit, CI, integração, deploy, operação e aceite** sem promover status indevidamente.

## 20 · Particularidades do Inbox

**Conversa ≠ protocolo P05.** Inbox controla conversas `open|pending|resolved`, `handoff=human|bot`, fila por operador, marcação de leitura/favoritos, mensagens `inbound|outbound|internal`, canal simulation/whatsapp e vínculo opcional CRM. Eventos de plataforma versionados não são streaming SSE. `fromMe`, grupo e origem `history` afetam `bot_eligible` e contador de não lidas. Mensagem WhatsApp enfileirada não significa entregue; não representar outbound como sucesso do provider. A transferência entre workspaces tem regra mais restritiva do que mero PATCH.

## 21 · Histórico, atualização e checkpoint

**17/11/2026 — DevServer01 atualizado:** Core Host image `syndes/core-host:inbox-assign-4126665`, baseado na SHA `4126665`, readiness e Kernel/FGA reais aprovados, 98 conversas preservadas, uma atribuição P04 elegível, `SYNDES_MULTI_ORG_ENABLED=false`, dispatch WA verdadeiro. [Relatório do deploy e rollback](IMPLANTACAO-DEVSERVER01-20261117.md). **Sem promoção de Product Gate:** JWT Keycloak navegador, FGA individual do futuro destinatário e ensaio de reversão continuam pendentes.


[Paridade de código](PARIDADE-CODIGO.md) distingue declaração de código, teste, integração, deploy e aceite. CI 16/11, commit `54bbc6c`: regressão Host/PostgreSQL **9 PASS**, separada dos 34 testes históricos. **Homologação operacional aberta**.


| Data | Registro | Limite |
|---|---|---|
| 12/11/2026 | [STATUS](STATUS.md) · 34 PASS históricos no checkout `b452a03e` | Sem JWT/FGA/tenant real e sem Product Gate |
| 16/11/2026 | Leitura de `src`, `sql`, `test`, frontend e contratos na SHA `24018b354392` | 17 HTTP + 2 consumidores; sem runtime |
| 16/11/2026 | Ficha Mestre, matriz, inventário e 19 fichas A–J | **Somente documentação**; sem SQL/deploy/worker |

**Próximo checkpoint candidato:** P02-VAL-01 — validar Host, Keycloak, OpenFGA, PostgreSQL e tenant A/B com evidência reproduzível. Não aprovar automaticamente.
