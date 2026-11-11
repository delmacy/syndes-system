# ADR — Propriedade imutável da projeção de inbounds WhatsApp (2026-11-11)

**Estado:** migration 008, filtros do legado e validações do novo Event Bus implementados e testados em PostgreSQL 17 descartável. **Não houve migration, implantação, switch de HTTP/bridge nem mudança de worker operacional.**

## Problema

O projetor legado `WhatsAppInboxProjection.deliverNext` consome `whatsapp_inbound_events` diretamente. A nova `WhatsAppTransactionalInboundBridge` persiste na **mesma tabela** antes de publicar `whatsapp.message.received.v2`. Sem distinção persistente, os dois consumidores podem processar o mesmo inbound e disputar a criação de conversa/mensagem. Mesmo com unique indexes da Inbox, isso pode alterar auditoria, contadores ou confirmar antes do processamento correto.

## Decisão: propriedade por registro, não por configuração do frontend

A migration tenant-local aditiva `modules/whatsapp/sql/008_whatsapp_projection_owner.sql` cria `whatsapp_inbound_events.projection_path` com valores `legacy` ou `events`, default **legacy**. A propriedade é imutável via trigger. Apenas `event_type='whatsapp.message.received'` pode receber path `events`; eventos de contato, chat snapshot e receipt continuam no caminho legado. Históricos anteriores são preservados como legacy, inclusive pendências.

- **Legado:** a query da fila acrescenta `COALESCE(to_jsonb(e)->>'projection_path','legacy')='legacy'`. Essa expressão é compatível **antes e depois** da migration (coluna ausente ⇒ legacy), evitando quebrar o deploy legado enquanto houver tenants em versões diferentes. Há custo de serialização JSONB da linha, a ser medido e posteriormente substituído por acesso direto/indexado quando todos os tenants tiverem migration homologada. Não antecipar essa otimização com risco de `column does not exist`.
- **Novo produtor:** insere `projection_path='events'` na mesma transação do outbox. Se migration 008 estiver ausente, falha e reverte; não faz fallback silencioso. Se o ID externo já pertence ao legado, retorna duplicado **sem publicar** outbox; se já pertence a eventos, mantém a publicação idempotente. Se um duplicado tiver conteúdo divergente, falha fechado.
- **Novo consumidor:** `PostgresWhatsAppInboundMessageReader` só lê inbound `events` e `PgWhatsAppConversationRouteCommands.attachAndAcknowledge` só confirma `events`, ambos no mesmo tenant/Organization/Workspace. Uma mensagem legada não pode ser consumida pela cadeia de eventos apenas por referência de ID.
- **Imutabilidade:** tentativa de trocar `legacy↔events` via UPDATE falha com SQLSTATE 23514. Índice parcial é aditivo para fila legada. A migration é reexecutável e não toca o bloqueio SQL002 single Organization/Workspace.

## Ordem operacional obrigatória (ainda NÃO executada)

1. **Backup/restore real homologado**, SQL migration 008 em staging, integridade histórica e perfil de performance aprovados.
2. Deploy de **todas** as instâncias do projetor legado com o filtro compatível, identificando builds antigos que ainda fazem SELECT sem `projection_path`. Um único processo antigo invalida a segurança do cutover.
3. Aplicar migration 008 em todos os tenants liberados, confirmar constraint/triggers e que pendências históricas continuam `legacy`. Reaproveitar prefixos de fixture somente em staging, nunca tenant ativo sem autorização.
4. Provisionar Control 001–006, tenant Event Bus 001–002, identidade OpenBao e grants de serviço reais, além de ENABLED/FGA e métricas de backlog. O runtime Nest atual **não injeta** a nova ponte, nem possui scheduler novo; a liberação deve vir de um gate Host-only com auditoria, não de cliente/UI.
5. No canário autorizado, selecionar um caminho de ingress para novas mensagens. O banco atribui propriedade por registro; mensagens anteriores não são migradas entre caminhos. **Contatos, snapshots de chat, receipts, histórico e outbound permanecem sob o legado** nesta fase text-only.
6. Monitorar entrega, duplicação, retries/dead, estabilidade Inbox/CRM e rollback. Ao reverter ingress para legacy, novos registros voltam a ser legacy, mas os registros `events` já existentes precisam concluir/reprocessar no Event Bus ou passar por procedimento manual auditado — **nunca UPDATE de projection_path em massa**.

**Atenção:** o filtro não impede que uma versão **antiga** de código legado, que não conhece a coluna, continue pegando linhas `events`. Essa é uma condição de rollout a ser garantida pelo operador, não uma propriedade garantida pelo schema sozinho. Não afirmar cutover protegido enquanto houver instâncias antigas.

## Evidências

`apps/core-host/test/whatsapp-projection-owner-pg17.test.mjs` aplica migrations reais em PG17 descartável e testa:
- Legado antes de 008 e bridge falhando fechado antes da migration.
- Upgrade replay-safe, default legacy, trigger imutável e constraint de tipo.
- Duplicado *legacy first* sem evento na outbox; *events first* invisível à seleção legada e entregue só ao consumer Inbox de eventos.
- Confirmação da nova fila e preservação do tratamento legado de metadados.

Testes existentes de WhatsApp, Inbox, CRM e cadeia PG17 também devem permanecer verdes. FGA e Control reais de staging foram exercitados separadamente pela PR #91, não implicando ativação operacional.

## Limites

O código incorpora **a capacidade de exclusividade por registro**, não um gate de implantação ou mecanismo de alternância operacional. Não há nova interface, não há mídias, não se alteram os 14 candidatos CRM, o Manager ou o frontend do cliente.
