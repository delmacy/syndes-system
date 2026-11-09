# ADR — Domínio e implementação do motor de funis (PROPOSTA)

**Status:** proposta, sem alterações em runtime.  
**Data:** 2026-11-08  
**Motivo:** definir fronteira técnica para configuração multi-tenant, protocolos, templates e integração à Inbox.

## Contexto existente verificado

- O repositório tem pacotes montáveis pelo Core Host via apps/core-host/config/modules.json, com definição, permissions e migrações, conforme docs/engineering/CORE-MODULE-MOUNTING.md.
- modules/inbox possui conversas e mensagens, atribuição, handoff e status open/pending/resolved. O esquema básico está em modules/inbox/sql/001_inbox_foundation.sql.
- Histórico WhatsApp usa a conversa canônica e não pode ser migrado para uma tabela de “etapa” nem ter eventos de funil enviados ao provedor.
- modules/scheduling existe como escopo planejado, mas não deve ser tratado como backend funcional de agendamentos até homologado.

## Decisão proposta

Criar bounded context **Gestão de Atendimentos** em um pacote NestJS montável novo, proposto como modules/service-management e @syndes/service-management. Não mover CRM, Inbox ou Whatsmeow para dentro dele. A UI do Workspace acessa a API tenant-scoped via Core Host; autorização real fica no backend.

### Agregados e contratos

- **ServiceGroup**: namespace organizacional (não confundir com WhatsApp group), nome, ativo.
- **ServiceFunnel**: identidade de funil, groupId, nome, lifecycle. Independente das equipes.
- **FunnelVersion**: snapshot de definição (stages, transitions, outcomes) com version, draft/published/archived, checksum e publishedAt; uma única publicada ativa por funil.
- **Stage**: stable key, nome, tipo entry/work/terminal, metadados de apresentação. Etapas não são obrigatoriamente lineares.
- **Transition**: fromStageKey, toStageKey, condição declarativa suportada, capacidades exigidas e tipo manual/automatic_resolved; sem código arbitrário.
- **ServiceTeamMembership / FunnelTeam**: associação N:N entre funis e equipes existentes, com escopo/função/capacidades; não criar uma segunda identidade de funcionário.
- **ServicePolicy**: identidade, classe, prioridade, calendário, SLA e roteamento; a versão utilizada deve ser rastreada. Começar sem engine de SLA avançada.
- **ServiceSession**: protocolo público único por tenant, objeto de solicitação (requestor), originChannel/conversationId opcionais, funnelVersionId, stageKey, status, outcomeId, revision e createdAt/closedAt.
- **ServicePlacement / Transfer**: cada permanência/passagem por um funil/etapa/equipe, com origem/destino, motivo e executor. Transferências simples preservam serviceSession e protocolo; trabalho paralelo pede subprotocolos correlacionados.
- **ServiceEvent**: append-only, eventId, tenantId, protocolId, action, actorId, reason, metadata mínima, createdAt, versão de definição.
- **ServiceMessageLink**: vínculo explícito de mensagem da Inbox a protocolo, sem alterar inbox_messages e sem inferir vínculos apenas por timestamp.
- **ServiceTemplate**: snapshot versionado de configuração, owner syndes/tenant, definição exportável sem membros, dados sensíveis ou credenciais.

### Persistência e invariantes

- Tabelas em PostgreSQL **por database de tenant**, respeitando tenant_id e chaves/índices compostos; evitar joins entre bancos de tenants.
- Publicar versão via transação: validar grafo, presença de etapa de entrada, resultados finais, alcance das etapas, ausência de transições inválidas; imutabilidade pós-publicação.
- Protocolos em execução referenciam funnelVersionId imutável; publicar v2 só afeta novas execuções por padrão.
- Mover etapa, concluir e transferir devem ser atômicos com evento append-only (e, onde necessário, outbox); optimistic lock por revision/expected revision; idempotency key em operações externas.
- Protocolo público exclusivo por tenant; não derivar tenant de número de protocolo, JID de WhatsApp, body ou query.
- Não dar GET ao agente sem capacidade; verificar também origem/destino da transferência; não copiar automaticamente conteúdo restrito entre equipes.
- Entitlement pode habilitar módulo; não confundir entitlement com concessão OpenFGA.
- Não manter duas fontes de verdade para estado do atendimento: Inbox conserva estado da conversa; ServiceSession conserva estado do protocolo.

### API proposta (contratos iniciais)

- GET/POST /v1/tenants/:tenantId/service/groups
- GET/POST /v1/tenants/:tenantId/service/funnels
- GET/PATCH /v1/tenants/:tenantId/service/funnels/:id/draft
- POST /v1/tenants/:tenantId/service/funnels/:id/validate
- POST /v1/tenants/:tenantId/service/funnels/:id/publish
- GET /v1/tenants/:tenantId/service/templates
- POST /v1/tenants/:tenantId/service/templates/:id/instantiate
- GET/POST /v1/tenants/:tenantId/service/sessions
- POST /v1/tenants/:tenantId/service/sessions/:id/transition
- POST /v1/tenants/:tenantId/service/sessions/:id/transfer
- POST /v1/tenants/:tenantId/service/sessions/:id/resolve
- GET /v1/tenants/:tenantId/service/sessions/:id/events

Estas URLs são proposta, não endpoints existentes. Não criar endpoints genéricos de execução de scripts. A lista de filas e projeções deve reutilizar esses estados e ser tenant/actor scoped.

### Permissões mínimas conceituais

- service:groups/read, service:groups/write
- service:funnels/read, service:funnels/write, service:funnels/publish
- service:templates/read, service:templates/instantiate
- service:sessions/read, service:sessions/create, service:sessions/transition, service:sessions/transfer, service:sessions/resolve
- service:team-membership/manage (somente se gestão de equipe pertencer ao contexto)

As permissões serão descritas pelo pacote, concedidas via provisionamento controlado e checadas no backend. Nenhum client-supplied actorId, groupId ou recipientId pode ampliar o escopo.

### Interfaces e componentes reaproveitáveis

- **FunnelDesigner**: editor de identidade, etapas, transições e outcomes; rascunho publicado separado.
- **TemplateLibrary**: lista/prévia e clonar configuração autorizada.
- **ServiceBoard**: renderizar funis ou filas verticais, sem assumir ordem fixa e sem salvar estado próprio.
- **ServiceQueue**: lista pessoal unificada e priorizável, sempre filtrada no servidor.
- **ServiceContext**: resumo de protocolo no Inspector, sem substituir CRM ou WhatsApp.

O operador pode navegar da Inbox à fila e vice-versa usando o mesmo protocolo. Evento interno de protocolo pode aparecer como marcador de histórico contínuo, **não** como mensagem enviada pelo WhatsApp.

### Política de testes e release

- Unit: validação de grafo, publicação, imutabilidade, transições permitidas, resultado e prioridade básica.
- Integração PostgreSQL: migração twice, RLS/roles se aplicável, tenant A/B, concorrência, idempotência, index por protocolo.
- Segurança: enumeração cross-tenant bloqueada, privacidade em transferências, leitura limitada por capacidade, auditoria.
- E2E com dados fictícios: clonar template → personalizar → publicar → abrir protocolo → atribuir → transferir → resolver → buscar marcadores.
- Regressões: CRM e Inbox existentes, recebimento Whatsmeow, histórico contínuo, avatar, receipts, scroll e autenticação Keycloak.
- CI do GitHub bloqueia deploy; artefato/commit aprovado é o único implantável em DevServer01; rollback de build sem desfazer migrações destrutivas.

## Alternativas rejeitadas

1. Reaproveitar inbox_conversations como protocolo: quebra histórico contínuo e mistura ciclos de vida.
2. Criar funis fixos Varejo/Premium/RH no código: impede customização por tenant.
3. Um funil por equipe: bloqueia N:N e operação compartilhada.
4. Um funil por classe de SLA: cria duplicação quando etapas são idênticas.
5. Editor de automação genérico desde o começo: amplia superfície de ataque e escopo antes de validar o processo.
6. Kanban como fonte de verdade: cria divergência entre Home, Inbox e relatórios.

## Sequência de PRs de engenharia

PR1: contrato + migração de catálogo/versionamento + autorização.  
PR2: APIs de rascunho, validação e publicação + Designer.  
PR3: Templates oficiais e por tenant + clonagem.  
PR4: ServiceSession, eventos imutáveis, transições e resultados.  
PR5: Transfers e associação N:N equipe/funil.  
PR6: Inbox: vínculo de protocolo e marcadores pesquisáveis; Inspector.  
PR7: Minha Fila, Kanban por funil e visões por perfil.  
PR8+: SLA, calendars, presença/plantão, priorização e Scheduling reais, cada qual com gate separado.

Esta ADR não altera MVP-SCOPE.md automaticamente. Exigir Product Gate antes de comprometer prazo ou habilitar clientes.
