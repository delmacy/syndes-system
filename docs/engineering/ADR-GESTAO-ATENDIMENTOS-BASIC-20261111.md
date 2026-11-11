# ADR — Funil Básico no MVP: fronteiras e implementação inicial (11/11/2026)

**Decisão de produto:** Gestão de Atendimentos Básica entra no MVP após WhatsApp/Inbox/CRM e antes de Scheduling/IA N1. **Decisão arquitetural:** domínio separado `modules/service-management`, sem depender de funil CRM comercial nem converter conversa em atendimento. Construtor visual, templates, protocolos genéricos e policies F0–F8 continuam pós-MVP.

## Domínios e fontes canônicas

| Fonte | É dona de | Não faz |
|---|---|---|
| CRM | Pessoa, organização comercial, identidade por canal | Transições de atendimento |
| Inbox | Conversa e mensagens contínuas, leitura/autorização dos canais | Protocolos e configuração do processo |
| WhatsApp | Transporte, eventos inbound/outbound e receipts | Funil ou atribuição |
| Gestão de Atendimentos | Funil/etapas, protocolo, posição, assignee, resultado e eventos de domínio | Reescrever mensagens ou criar funcionários |
| Syndes Support | Fila/caso de suporte interno e externo da fornecedora | Fornecer funis genéricos a todo tenant |
| Workforce/Organizations | Identidade de funcionários e membership de Workspace | Derivar autorização a partir de `assigned_to` |

### Primeira fatia entregue em código (SM-02)

- `sql/001_service_funnels.sql`: quatro tabelas tenant-local: funil publicado, suas etapas, protocolo/atendimento, eventos append-only. FKs compostas `tenant_id+organization_id+workspace_id`; o caso referencia uma conversa existente opcionalmente, mas **nunca** copia mensagem. A migration não toca schemas do CRM, Inbox, WhatsApp ou Support.
- Catálogo Basic com 2 a 8 etapas ordenadas configuradas pelo cliente; exatamente a última é terminal. Um único release imutável v1, sem editar funil publicado ou fazer updates invisíveis. Nova revisão/snapshot exige contrato posterior, não improvisar.
- `ServiceFunnelService`: execução autorizada por `CoreKernel.executeModule` (membership tenant + resource FGA + Control ENABLED fail-closed) e transação pinned; membership Organization/Workspace real para leitura, escrita e publicação.
- Abertura idempotente de protocolo no primeiro estágio (chave exata por tenant/Organization/Workspace; retry com payload diferente dá conflito); transição de **uma etapa adjacente por chamada**; atribuição só a principal que já é membro ativo editor/admin de Organization/Workspace; conclusão apenas no estágio terminal com resultado; listas e histórico para atores autorizados.
- **Concorrência:** `version` monotônica em update CAS. Tentativa stale / salto de etapa / escopo ausente não altera nada. Operação de domínio e auditoria em uma transação PostgreSQL: trigger exige `syndes.service_actor_id` apenas dentro do `withTransaction` controlado pelo Host. Append-only não permite UPDATE/DELETE/TRUNCATE. O database owner/superuser precisa continuar segregado dos runtime roles (gate futuro).
- **Dependência da conversa:** ao abrir, a referência Inbox precisa ter mesmo tenant, Organization e Workspace atual. Se a Inbox transferir a conversa depois, **qualquer link/visibilidade no frontend deve ser reautorizado** no destino; transferência entre workspaces/organizations NÃO está implementada.
- **Existe plugin/controller Nest opt-in no incremento SM-03**, mas ele **não está em `config/modules.json`**, portanto não há API operacional, migration em tenant real, grant real ou item de menu. O artefato do Host inclui o pacote desativado até Control/ENABLED, identidade, grants e restore homologados.

## Prova local e limites

`bash scripts/service-management/run_disposable_pg17.sh --disposable --ack-synthetic` exige flags explícitas, recusa contêiner/porta preexistente, usa PostgreSQL 17 novo com porta **loopback** 32772, banco separado por tenant, dados sintéticos, e apaga o contêiner no final. Evidência local: **16/16 testes aprovados após SM-03 (PG17, Nest sintético e unidade)** em PostgreSQL 17 descartável e segurança unitária. `service-funnels-pg17.test.mjs` cobre publicação e imutabilidade, Inbox opcional, atribuição autorizada, transição CAS, fechamento, eventos append-only, viewer/revogado/FGA denegado e isolamento de dois bancos. Nenhum número real ou PII é usado.

**Lacuna de CI:** `scripts/ci/plan.mjs` e `run-suite.sh` ainda não definem suite `service-management`. Portanto o Mainline CI Gate não cobre automaticamente os testes desse pacote. **SM-02D** deve ser feito pela frente responsável por GitHub Actions/CI antes de declarar regressão contínua; a presente PR não altera workflows ou scripts CI.

**Isto não equivale à homologação de release:** serviço FGA é port do Kernel simulado no teste, sem provisionar OpenFGA real; o plugin não é carregado no Nest operacional. Continuam pendentes Workforce/team e transferência, UI/Inspector/Kanban, restore operacional, migração de tenant e Product Gate.

## Sequência de rollout obrigatória

1. Concluir **SM-02** em código/teste e CI sem mexer no legado.
2. Validar release/installer, Control, PostgreSQL role least privilege e resource FGA de serviço/usuário no Host; só então montar API e inserir entitlement **SM-03**.
3. Integrar Workforce para transferência segura **SM-04**; não usar string de equipe sem entidade real.
4. Construir UI baseada em dados autorizados e testes de navegador **SM-05**.
5. Em staging autorizado, executar migrations após backup/restore real, tenant A/B, Keycloak/OpenFGA, rollback e Product Gate **SM-06**.
6. Priorizar piloto de atendimento real antes de avançar editor visual, templates ou motor de automações.

**Restrição:** SQL 002 single Organization/Workspace não é removido. Mesmo com FKs tenant/org/ws, isso não libera multi-org nem cross-Workspace.
