# P02 Inbox — Paridade comprovável entre código e documentação

> **Reconciliação de 16/11/2026, revisão de código na SHA `54bbc6c2501a6d2313a68467d13664f828358be3`.** Este documento descreve implementação encontrada no repositório, não comportamento homologado em produção. **O template Ficha Mestre v1.0.0 não foi alterado.**
>
> **Fonte de verdade:** módulos donos dos contratos e do SQL, não telas do portal. O catálogo [ACOES.json](ACOES.json) indexa as ações; [MATRIZ](MATRIZ-ACOES.md) mapeia 17 decorators HTTP + dois consumers, e as [19 fichas](MATRIZ-ACOES.md) devem apontar para as mesmas fontes.

## 1 · Escala e evidências com estados independentes

| Dimensão | O que está comprovado | O que NÃO foi comprovado |
|---|---|---|
| Código | 17 rotas `Get/Post/Patch` no `InboxController`, 2 `handle` de eventos, recursos no plugin | Rotas instaladas e autorizadas em produção |
| Contrato | `@syndes/core-inbox` e `@syndes/core-inbox/plugin`; parâmetros e recursos lidos na fonte | Um contrato público adicional sem export |
| Persistência | Três tabelas em P02 SQL 001; extensões em P04 Organizations e P03 WhatsApp | Aplicação e ordem real das migrations num ambiente alvo |
| Testes históricos | `34 PASS`, checkout `b452a03e`, 12/11, auditoria parcial | PASS de todos os 19 casos na SHA atual |
| CI de 16/11 | [Run 43930160944](https://github.com/delmacy/syndes-system/actions/runs/43930160944): job **Regression / inbox** passou; logs indicam **9 PASS, 0 FAIL** em teste de Host + PostgreSQL | Keycloak + OpenFGA reais, webhook/WhatsApp live, dispositivo real ou aceite do proprietário |
| Portal | [Run 43930160900](https://github.com/delmacy/syndes-system/actions/runs/43930160900): **18 testes de conteúdo, 12 mobile** e deploy passaram | O portal de docs não prova funcionalidade do P02 em runtime |

**Regra:** `CÓDIGO DECLARADO` ≠ `TESTADO EM CI` ≠ `INTEGRADO` ≠ `DEPLOYADO` ≠ `HOMOLOGADO`. Nunca promover uma coluna por inferência de outra.

## 2 · Migrações reais e propriedade dos campos

| Fonte (ordem lógica de dependência; não runbook de deploy) | Owner | Efeito verificado no SQL | Evidência operacional |
|---|---|---|---|
| [`001_inbox_foundation.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/sql/001_inbox_foundation.sql) | P02 Inbox | Cria `inbox_conversations`, `inbox_messages`, `inbox_events`; FK para CRM | **Aplicação não verificada** |
| [`002_legacy_single_context_gate.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/organizations/sql/002_legacy_single_context_gate.sql) | P04 Organizations | Índices `platform_legacy_single_organization` e `platform_legacy_single_workspace` para bloquear múltiplas orgs/workspaces no legado | **Aplicação não verificada** |
| [`003_legacy_ownership.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/organizations/sql/003_legacy_ownership.sql) | P04 Organizations | Adiciona `platform_organization_id`, `platform_origin_workspace_id`, `platform_current_workspace_id` ao Inbox; chaves e triggers de ownership | **Aplicação/backfill não verificados** |
| [`005_whatsapp_history.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/whatsapp/sql/005_whatsapp_history.sql) | P03 WhatsApp | Adiciona `is_group`, `unread_count`, `is_favorite`, `is_archived`, `history_sync_at`, `source`, `bot_eligible`, `provider_message_id`, `provider_sender_id` | **Aplicação não verificada** |
| [`003_whatsapp_outbound_inbox.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql) | P03 WhatsApp | Rota `whatsapp_conversation_routes`, FK de conversa e referência outbound | **Aplicação não verificada** |
| [`005_scoped_relationship_integrity.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/organizations/sql/005_scoped_relationship_integrity.sql) | P04 Organizations | Regras de vínculo CRM/Inbox owner-scoped e pré-flight contra relações cruzadas | **Aplicação não verificada** |
| [`008_whatsapp_projection_owner.sql`](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/whatsapp/sql/008_whatsapp_projection_owner.sql) | P03 WhatsApp | `projection_path=legacy|events` e imutabilidade da escolha para cutover do projetor | **Cutover não verificado** |

**Nota sobre ordenação:** a tabela não é uma sequência de instalação; arquivos de WhatsApp/Organizations possuem dependências e pré-flight próprias. A ordem, compatibilidade, checksum, backfill, restore e rollback precisam ser obtidos do Host migrator e testados em banco descartável com todas as dependências, nunca aplicados manualmente por uma ficha.

**Constatação importante:** `src/plugin.ts` do P02 declara somente a migration **`001_inbox_foundation`**. Não é correto esperar que a ativação isolada do P02 instale os campos posteriores: seus owners são P03/P04. O código atual **consome** esses campos, portanto requer uma matriz de readiness cross-module.

## 3 · Comportamentos encontrados que devem orientar futuras decisões

| Ação | Efeito concreto hoje | Consequência para proposta |
|---|---|---|
| [Vincular pessoa CRM](acoes/p02-crm-link.md) | `PgInboxRepository.linkContact` executa `SET crm_person_id=$3` quando a pessoa existe no escopo; **não exige `crm_person_id IS NULL` ou igualdade com vínculo atual**: [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/postgres.ts#L151-L169) | **P0: decidir** se vínculo manual pode substituir contato e, se puder, quais autorização, confirmação e auditoria especial são exigidas. Sem mudança de código aprovada |
| [Receber vínculo por evento CRM](acoes/p02-crm-resolved-event.md) | `InboxCrmPersonResolvedConsumer.handle` usa `FOR UPDATE`, aceita idempotência com mesma Person e rejeita Person divergente, além de exigir `validateLink`: [consumer](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/crm-link-event-consumer.ts) | Política **mais restritiva** que a API manual; paridade de negócio precisa de decisão explícita |
| [Atribuir responsável](acoes/p02-assignment-set.md) | **P02-ASSIGN-01 implementado no código:** `PgInboxRepository.assign` exige membership org + workspace ativa `editor/admin` para o destinatário no escopo atual, com `FOR NO KEY UPDATE` da conversa e `FOR SHARE` das memberships na mesma instrução de `UPDATE`; idêntico válido é no-op, inválido 404 genérico, `null` libera. [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/main/modules/inbox/src/postgres.ts) | **A validar em staging:** grants FGA individuais/identidade efetiva do destinatário, correção de atribuições históricas, migrations P04/backfill e política de cargo especializado |
| [Marcar como lida](acoes/p02-conversation-read.md) | `markRead` zera `unread_count` no WhatsApp e retorna a linha; **não insere em `inbox_events`**: [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/postgres.ts#L144-L149) | **P1: decidir** se leitura exige trilha/auditoria por política de produto ou se a ausência é intencional |
| [Favorito](acoes/p02-conversation-favorite.md) | `favorite` atualiza e insere `favorite_changed` em `inbox_events`, sem checagem `IS DISTINCT FROM`: [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/postgres.ts#L131-L142) | Repetição do mesmo valor pode gerar novo evento de auditoria |
| [Atribuição, status, handoff](acoes/p02-conversation-status.md) | `PgInboxRepository.change` faz `IS DISTINCT FROM`; ação idêntica devolve snapshot sem novo evento, mas controller pode publicar SSE `changed`: [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/postgres.ts#L106-L129) | Diferenciar *no-op de banco* de *invalidação para a UI*; métricas SSE não equivalem a alterações |
| [Responder/anotar](acoes/p02-message-reply.md) | `append` só permite outbound/internal se `status <> resolved`, `handoff=human` e `assigned_to=actor.id`; em `simulation`, inbound idempotente ou 409 se payload diverge: [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/postgres.ts#L170-L224) | Contrato de resposta depende de atribuição, estado e modo; **não** atribuir garantia de entrega WhatsApp |
| [Transferir workspace](acoes/p02-workspace-transfer.md) | `transferWorkspace` exige roles `admin|editor` ativas em origem e destino, mesma org e `inbox:assignment/write`, retorna nulo se destino atual: [src/postgres.ts](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/postgres.ts#L232-L285) | Não confundir mudança de workspace com mudança de responsável nem autorização apenas por JWT |
| [SSE](acoes/p02-realtime-events.md) | `InboxChangeBus`: evento sem PII em **uma instância**; stream expira em 60s, heartbeat 15s, recheck 5s apenas em `enforce`: [código](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/realtime.ts) | Multi-Host precisa estratégia de distribuição ou restrição de implantação |
| [Simulador](acoes/p02-simulation-inbound.md) | `externalMessageId` é **obrigatório** em `InboxService.simulate` e usado em retry/dedup: [código](https://github.com/delmacy/syndes-system/blob/54bbc6c2501a6d2313a68467d13664f828358be3/modules/inbox/src/service.ts) | Nunca expor simulação como webhook público |

## 4 · Dependências externas e o que o P02 não faz

| Dono | Contrato efetivo | Limite |
|---|---|---|
| A04 Host / A08 Kernel | JWT, resolução confiável de Tenant DB, grants e módulo ENABLED quando enforce | `legacy` não é `enforce`; header de escopo não é prova de autorização |
| P01 CRM | Person canônica e revalidação de identidade no consumer | P02 não decide deduplicação/merge |
| P03 WhatsApp | Conta, rotas, histórico, entrega outbound e policy do provider | Enfileirar não comprova entrega; Inbox não processa mídia neste MVP |
| P04 Organizations | Org/workspace, memberships, migrations 002/003/005 | Header não concede tenancy nem autoriza transferir |
| C06 Event Bus | `whatsapp.message.received.v2`, `inbox.participant.observed.v1`, `crm.person.resolved.v1` | Consumers em código ≠ worker ligado |
| A01 Workspace | UI operacional `apps/workspace-web/src/features/inbox.tsx`, api client e SSE/polling | Teste browserless de frontend não substitui navegador com Keycloak/FGA |
| P05 Gestão de Atendimentos | Funil, protocolo e etapas | O Inbox não deve manter cópia paralela desses dados |

## 5 · Matriz de readiness e decisão — sem tarefas automaticamente aprovadas

| Prioridade para análise | Proposta futura | Evidência necessária para decidir |
|---|---|---|
| P0 | Regra de substituição manual de CRM Person versus link automático conservador | Caso de uso, consentimento do operador, permissão, trilha de auditoria e negativos |
| P0 | Cadeia de migrations + índices e integridade multi-org no Tenant DB | Inventário dos owners, checksums, banco descartável, replay, backup/restore e gate |
| P1 | Extensão de elegibilidade além de membership `editor/admin` | Grants reais do destinatário, papel de operador dedicado e saneamento de assigned_to históricos; base P02-ASSIGN-01 implementada em código |
| P0 | Entrada WA, vínculo CRM e resposta do operador ponta a ponta | Service principal/worker opt-in, no duplicate projector, Keycloak/FGA e tenancy A/B |
| P1 | Política de `markRead` e eventos repetidos de favorito/SSE | Necessidade de auditoria, idempotência de UI, carga e métricas |
| P1 | Distribuição de SSE ou limitação explícita a um Host | Topologia aprovada, testes multi-réplica e reconexão |
| P1 | Testes de UX do Workspace com usuário real | Mobile, teclado, histórico longo, erros e acessibilidade |

**Nenhum item acima foi decidido ou implementado nesta auditoria.** Promover para WBS somente depois da escolha do proprietário e delimitação de owners, impacto e critérios de teste.

## 6 · Como manter o espelhamento sem burocracia

O teste `apps/docs-reader/tests/content.test.mjs` agora valida **rotas ↔ catálogo ↔ 19 fichas A–J**, **recursos declarados no plugin ↔ catálogo**, **migrations multi-owner ↔ tabelas documentadas** e **diferenças CRM manual/automático**. Se alguma superfície for removida/renomeada sem atualizar a documentação, a CI deve falhar. Isso é controle de **paridade estrutural**, não validação de comportamento por execução da plataforma.

**Na próxima proposta:** escolha `P02 + ação ID + problema observado`. O agente deve consultar esta paridade, a [Ficha Mestre](FICHA-MODULO.md), o [STATUS](STATUS.md) e os testes reais antes de propor código.

## 7 · P02-ASSIGN-01 — implementação e evidência na CI

**Código confirmado em `8de743e`:** atribuição agora resolve o destinatário no P04 na mesma instrução SQL da escrita, usando `FOR NO KEY UPDATE` na conversa e `FOR SHARE` em `platform_org_memberships`, `platform_workspace_memberships`, organização e workspace. Apenas `editor/admin` ativos na organização/workspace atuais podem receber uma conversa. `viewer`, revogado, alvo inexistente ou externo são recusados como 404 genérico; `null` libera, no-op válido não gera auditoria adicional.

**Prova de teste:** [Syndes Mainline CI — run 43939884169](https://github.com/delmacy/syndes-system/actions/runs/43939884169), job `Regression / inbox` **SUCCESS** na SHA `8de743e`: `npm test` 35 PASS, escopo PG 1 PASS, persistência PG 1 PASS, corrida/revogação com duas sessões PostgreSQL 1 PASS, Host HTTP 9 PASS. A fixture `pg-integration.mjs` faz ROLLBACK antes da próxima suíte, corrigindo contaminação de defaults.

**Limites:** não checa permissões OpenFGA individuais ou login real do destinatário; não repara `assigned_to` antigos inválidos; migrations/backfill P04 continuam pré-requisitos de implantação. Product Gate permanece aberto.

## 8 · Pré-homologação P02-ASSIGN-02

[Plano de testes PG/FGA](PRE-HOMOLOGACAO-ASSIGN.md): auditoria somente leitura dos responsáveis legados (sem reparar dados), migration gates 002/003/backfill e OpenFGA real mas descartável. **Gap preservado:** a implementação P02-ASSIGN-01 não consulta grant individual OpenFGA do destinatário. Não declarar essa lacuna fechada em razão de teste isolado do modelo.


## P02-ASSIGN-03 · Paridade de autorização por destinatário (candidato 17/11/2026)

- `modules/inbox/src/service.ts#assign`: ator passa `inbox:assignment/write` via Kernel. Destinatário não nulo é tratado como `user:<principal>` verificado pelo `CoreKernel.execute` duas vezes: tenancy Control e OpenFGA `inbox:conversations/read`, depois `inbox:messages/write`. As chaves de recurso continuam no formato padrão de C04, com hash SHA-256 tenant+recurso.
- `modules/inbox/src/postgres.ts#assign`: mantém gate P04 `admin/editor` ativo na organização e workspace da conversa, sob lock SQL. Nenhum novo SQL/DDL foi introduzido.
- Resultado de FGA `allowed=false` ou membership Control ausente: `AccessDeniedError` do destinatário vira `null`/HTTP 404 genérico, sem atualização nem evento. Falha do provedor OpenFGA: exceção propagada/503, não permitir por omissão. O `null` para liberar ignora checagem do alvo inexistente.
- Validação: `modules/inbox/test/inbox.test.mjs`, `apps/core-host/test/inbox-pg-http.integration.mjs` e `modules/inbox/test/fga-assignment-preflight.mjs`, com repositórios e store OpenFGA descartáveis. **Resultados da CI da branch ainda pendentes**.
- Segurança residual: revogação de membership P04 é sincronizada no SQL, mas a autorização remota FGA não está sob a mesma transação do `UPDATE`; não prometer atomicidade entre sistemas. Testes reais de Keycloak, concessão/revogação operacional, canário e rollback permanecem gates abertos.
