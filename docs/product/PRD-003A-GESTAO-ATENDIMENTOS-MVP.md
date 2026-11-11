# PRD-003A — Gestão de Atendimentos Básica (MVP)

**Decisão de produto: aprovada em 2026-11-11.** Entra no MVP comercial após WhatsApp, Inbox e CRM, antes de Scheduling e IA N1. Este é o recorte **essencial** da proposta `PRD-FUNNELS-AND-TEMPLATES-PROPOSAL.md`, não a aprovação de F0–F8 completos.

## Problema de negócio e fronteiras

A conversa de WhatsApp/Inbox é contínua; **o atendimento é uma solicitação com começo, andamento, responsável e encerramento**, mesmo que várias solicitações usem a mesma conversa. CRM identifica pessoas/organizações, Inbox mantém o histórico canônico e Gestão de Atendimentos mantém protocolo, etapa, atribuição e auditoria. Nunca duplicar mensagens nem transformar os estados `open/pending/resolved` da Inbox em estados de funil. O módulo Syndes Support continua específico da operação da fornecedora e não vira engine genérica do cliente.

## Dentro do MVP

1. Funil **configurável por tenant + Platform Organization + Workspace**, com nome e etapas ordenadas escolhidas pelo gestor; uma etapa final. Não fixar "Vendas", "RH" ou "Triagem" no domínio.
2. Protocolo imutável por atendimento, com abertura idempotente por chave de requisição estável, independente do ID da conversa, com vínculo **opcional** à conversa existente da Inbox no mesmo escopo.
3. Abertura, alteração manual para etapa adjacente autorizada, atribuição a funcionário já autorizado no Workspace e conclusão em etapa final com resultado.
4. Histórico append-only: ator verificado, etapa anterior/posterior, atribuição anterior/posterior, data e resultado; concorrência com versão/409 e idempotência de comando conforme contratos aprovados.
5. **Visualização simples** de lista/colunas por etapas (Kanban), usando **a mesma API e mesma source of truth**; Inspector de atendimento na Inbox mostra protocolo, etapa, responsável e histórico, sem alterar a conversa canônica.
6. Transferência de atendimento **para outra equipe do mesmo Workspace**, com verificação de elegibilidade no destino, histórico e sem conceder acesso automaticamente. Primeiro fechar o contrato Workforce e grants de equipe; não simular equipe usando string arbitrária.
7. Serviço backend isolado e montável no NestJS Core Host; endpoints com tenancy + membership Organization/Workspace + FGA + Module ENABLED reais. Isolamento negativo A/B é obrigatório.
8. Integração somente textual com WhatsApp na primeira liberação; IA N1 e Scheduling **consomem** o contrato de atendimento quando estiverem prontos, não se tornam donos do protocolo.

## Fora do MVP (WBS 80: pós-MVP)

Criador visual drag-and-drop, biblioteca/clonagem de templates, publicação de revisões complexas, grafo arbitrário, BPMN, subprotocolos, automações configuráveis, políticas avançadas de SLA/presença/capacidade, transferências cross-funnel e cross-Organization, múltiplos funis paralelos automatizados, regramento por classe de serviço e dashboard analítico avançado.

## Restrições de segurança

- Banco por tenant; escopo exige IDs reais de Organization/Workspace escolhidos e autorizados; **sem fallback ao default**, sem liberação do SQL002 multi-Organization.
- Somente ator OIDC do Host; escrita exige FGA `service:funnels` ou `service:attendances` e membership ativo editor/admin. Não confiar em `assignedTo`, `tenantId` ou `workspaceId` do frontend sem validar.
- Atribuir alguém **não cria** nova membresia FGA/SQL. Transferência valida equipe de destino e acesso antes da mudança. Nunca criar "equipe default" implícita.
- Eventos de protocolo auditáveis, append-only e no mesmo commit da mudança; histórico WhatsApp permanece imutável.
- Deploy depende de backup/restore real, installer/entitlement, CI, smoke autenticado, controles de acesso e Product Gate.

## Definition of Done e aceites

- Admin cadastra funil com etapas próprias; somente membros autorizados podem operar; configuração publicada não se altera em atendimentos em andamento.
- Atendente autorizado abre protocolo vinculado opcionalmente a conversa real e move uma etapa válida; tentativa de pular etapa ou usar versão obsoleta responde 409/422 sem mutação.
- Responsável é usuário ativo do Workspace; um viewer, usuário revogado ou de outro tenant/Organization/Workspace não pode ser atribuído nem executar ação.
- Auditoria da criação/movimentação/atribuição/conclusão é atômica, sem alteração de mensagens.
- Operador vê lista/Kanban de atendimentos autorizados por estágio, não uma UI fictícia; funcional com viewport desktop/mobile e testes de navegador.
- Transferência para equipe autorizada preserva ID de protocolo e faz nova avaliação FGA do destino; usuário não autorizado não ganha leitura por observar ID.
- Restore de tenant, rollback, concorrência e revogação aprovados em staging; pelo menos um cliente externo pagante utilizando a solução no MVP completo.

## Execução por entregas menores

**SM-01** baseline/ADR/WBS e contratos; **SM-02** schema, etapas configuráveis e protocolo/auditoria com PG17 A/B; **SM-03** Host controller/service, JWT, FGA e módulo ENABLED; **SM-04** atribuição e transferência com Workforce real; **SM-05** Inbox Inspector, lista/Kanban sem duplicação; **SM-06** E2E, restore, canário, Product Gate. A ordem obedece dependências, não equivale a declarar tudo implementado.

**Status após esta decisão:** escopo aprovado; o desenvolvimento e a homologação passam pelos gates SM-01…06. Não alterar a estimativa do MVP como se o funil inteiro já estivesse entregue.
