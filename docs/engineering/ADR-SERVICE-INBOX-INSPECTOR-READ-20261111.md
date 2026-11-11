# ADR — Inspector Inbox: leitura autorizada de protocolos por conversa (SM-05A backend)

**Data:** 2026-11-11 · **Status:** implementação opt-in, testes sintéticos PG17, sem ativação operacional.

## Contrato e propriedade dos dados

A Inbox é a fonte canônica para **conversa, ownership atual e mensagens**; Service Management mantém **protocolo, funil, etapa, responsável, equipe e estado**. O Inspector precisa apenas de uma projeção por `conversationId`, sem duplicar mensagens WhatsApp, CRM ou registro de conversas.

Rota disponível **apenas quando o plugin for instalado e habilitado**:

`GET /v1/tenants/:tenantId/service-management/conversations/:conversationId/attendances`

Headers exigidos: `Authorization: Bearer <OIDC JWT>`, `x-syndes-organization-id`, `x-syndes-workspace-id`. O token determina o principal; os headers apenas selecionam escopos que o servidor reautoriza. UUIDs malformados geram 400, ausência de JWT 401, falta de FGA/entitlement 403, banco indisponível 503.

Retorna um array JSON **de até 50 protocolos**, ordenados por criação mais recente, incluindo protocolos abertos e encerrados. Cada elemento contém apenas:
- `id`, `protocol`, `funnelId`, `stageId`, `conversationId`;
- `assignedTo` e `teamId` (ambos opcionais/nulos);
- `state`, `result` (opcional/nulo), `version`.

**Não inclui** corpo de mensagem, PII de contato, telefone, histórico de WhatsApp, notas ou detalhes não autorizados da Inbox. O frontend deve renderizar esses elementos a partir das APIs canônicas correspondentes, sem inventar contatos, filas ou mensagens.

## Autorização em camadas

1. `Kernel.executeModule(inbox, inbox:conversations, read)` exige tenant membership, FGA de leitura da Inbox e módulo Inbox **ENABLED**.
2. `Kernel.executeModule(service-management, service-management:attendances, read)` exige o próprio entitlement ENABLED, FGA de atendimento e membership do tenant.
3. Na mesma conexão/transação PG17 pinada, os vínculos de Organization e Workspace do usuário precisam estar ativos; não há seleção default silenciosa.
4. O SQL faz JOIN com `inbox_conversations` **somente** quando `tenant, organization e platform_current_workspace_id` correspondem ao protocolo. A equipe corrente é revalidada via `service_team_can_read` a cada consulta. Usuários revogados ou equipe anterior não veem protocolos daquela equipe.
5. IDs de conversas inexistentes ou de outro tenant/Workspace retornam array vazio, não detalhes de autorização. Falhas na dependência/DB negam acesso.

A consulta não altera Inbox, CRM ou WhatsApp. Não usa eventos para leitura síncrona nem chama comandos cross-module; Event Bus permanece mecanismo para fatos assíncronos.

## Migration, testes e gates

`modules/service-management/sql/003_service_conversation_inspector.sql` adiciona somente um **índice parcial tenant/org/workspace/conversation/created_at/id**, sem copiar dados, com preflight 55000 se Service 002/Workforce 007 não estão presentes. É aditiva e registrada no plugin v0.3.0, mas não aplicada em produção. Ela requer as migrações 001/002 e **Organizations/007 manual**, com SQL002 physical gate preservado.

Prova local: `bash scripts/service-management/run_disposable_pg17.sh --disposable --ack-synthetic` (dois bancos sintéticos, 19/19 testes) verifica lookup por conversa, Inbox FGA negada, Inbox module suspended, separação A/B, equipe origem/destino após transferência, leitura de protocolos fechados, índice 003 reaplicado e preflight antes da migration 002. Os testes HTTP Nest cobrem 400/401/403/503 e ausência de banco após FGA negado.

**Limites pendentes:** UI Inspector na worktree de frontend não alterada nesta execução; identity/FGA reais e grants, restore do staging, installer/Control ENABLED, papel SQL least privilege, monitoramento e Product Gate. O lookup é limitado a 50 protocolos por conversa neste recorte; paginação futura exige cursor estável e novo contrato. Não simular transferência entre Workspaces enquanto SQL002 e trigger de ownership legado impedirem esse fluxo.
