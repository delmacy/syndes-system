# PRD-002 — Inbox Product Spec (draft)

## Estado e controle

- Classificação: `MVP`.
- Módulo: Inbox, próximo na ordem funcional após o Core CRM.
- Estado: baseline de Product Gate e execução autorizado pelo usuário em 2026-10-28; Sprint 0 registrado no plano de entrega.
- Escopo-base: `modules/inbox/AGENTS.md` e `docs/product/MVP-SCOPE.md`.
- Referência de produto: padrões de caixa compartilhada do Chatwoot; nenhuma implementação ou dependência de código do Chatwoot está sendo proposta.
- Stack aprovada: NestJS, Next.js App Router, Drizzle ORM e PostgreSQL.

## Objetivo

Permitir que os atendentes de uma empresa acompanhem e respondam conversas de clientes em uma caixa compartilhada, com atribuição, histórico e colaboração, mantendo a identidade do cliente no Core CRM e as fronteiras de tenant impostas no servidor.

## Particularidades Syndes preservadas

- **Tenant é o workspace do cliente.** Cada tenant mantém seu próprio database PostgreSQL. O Control Plane separado é a fonte de verdade para tenants, identidades, memberships, papéis e `customer_scope`; nunca se cria outro cadastro de workspace dentro do Inbox.
- **CRM continua canônico.** Inbox não cria uma segunda tabela de clientes. Conversas apontam para a `Person` do CRM quando identificada; Organization e contexto PJ são obtidos pelos relacionamentos existentes no CRM. Identidades externas de canal continuam vinculadas à Person por `ChannelIdentity`.
- **Pessoa, perfil de atendente e login não se confundem.** `Person`, `Employee` e identidade Keycloak/actor permanecem conceitos separados. O responsável por uma conversa é uma identidade de membro ativa do tenant; o perfil Employee pode fornecer seus dados de exibição quando estiver vinculado a esse actor.
- **Autorização usa os contratos atuais.** `tenant_admin` administra as conversas do tenant. `tenant_member` trabalha nas conversas dentro de seu escopo fixo `cpf`, `pj` ou `both`. O backend filtra listas, busca, detalhes, atribuição, mensagens, notificações em tempo real e anexos antes de devolver qualquer dado.
- **Sem acesso implícito do Platform Admin.** A tela de gestão da plataforma continua restrita aos metadados e provisionamento do tenant; não ganha acesso ao conteúdo de conversas.
- **Uma tela operacional compartilhada.** Admins e atendentes usam a mesma experiência de Inbox, com ações habilitadas conforme o papel. Não criar portal separado para Employee, papéis customizados ou um permission engine.
- **Canais desacoplados.** Inbox consome eventos e solicita envios por contratos internos; não importa diretamente SDK ou detalhes de WhatsApp/email. O canal real é entregue no módulo correspondente.

## Usuários e permissões

| Usuário | Acesso proposto |
|---|---|
| `tenant_admin` | Consultar e operar conversas de todos os escopos do tenant, atribuir responsáveis, atualizar estado e administrar configurações mínimas da caixa. |
| `tenant_member` com `cpf` | Operar somente conversas ligadas a pessoas sem vínculo PJ, segundo a regra canônica do CRM. |
| `tenant_member` com `pj` | Operar conversas de organizações PJ e das pessoas de contato ligadas a essas organizações. |
| `tenant_member` com `both` | Operar conversas de ambos os escopos. |
| Platform Admin | Sem acesso a mensagens ou anexos do tenant por sua função de plataforma. |

Toda autorização deve ser aplicada pela API com `TenantContext`; ocultar controles na UI não constitui autorização.

## Capacidades do MVP

1. **Fila compartilhada:** listar conversas não resolvidas e resolvidas, com paginação e filtros simples por estado, canal e responsável; exibir estado vazio, carregamento, erro e sessão expirada.
2. **Detalhe da conversa:** mostrar mensagens em ordem estável, dados CRM autorizados do cliente, canal, estado, responsável e histórico essencial de mudanças.
3. **Resposta e nota interna:** distinguir visual e contratualmente mensagem enviada ao cliente de nota interna; nota interna nunca pode chegar ao canal externo.
4. **Atribuição:** permitir fila sem responsável e atribuição a um membro ativo do mesmo tenant, respeitando escopo e associação válida de Employee quando existente. Não há conceito de equipes/filas customizadas neste MVP.
5. **Estado:** suportar `open`, `pending` e `resolved`; mensagem nova recebida pode reabrir conversa resolvida conforme contrato idempotente do canal. Não incluir snooze ou timers de SLA.
6. **Anexos:** validar tipo e limite de tamanho no servidor; recuperar conteúdo somente com autorização da conversa e do tenant.
7. **Tempo real:** propagar eventos mínimos de novas mensagens, atribuição e mudança de estado após validar sessão, tenant e escopo; após reconexão, recuperar estado persistido pela API.
8. **Handoff humano:** sinalizar claramente quando a conversa está aguardando atendente/resposta humana e registrar mudança de responsável/estado.
9. **Histórico/auditoria:** preservar mensagens e autoria; auditar ações críticas sem gravar tokens, credenciais ou conteúdo sensível desnecessário nos logs operacionais.

## Contrato HTTP inicial

Rotas tenant-facing são autenticadas e sempre usam o `TenantContext` resolvido no servidor:

- `GET /api/v1/inbox/conversations?status=&assignee=&channel=&page=&pageSize=` — fila paginada, com filtros aplicados depois de autorização e `customer_scope`.
- `GET /api/v1/inbox/conversations/:id` — detalhe autorizado e dados CRM necessários à tela.
- `GET /api/v1/inbox/conversations/:id/messages?after=&limit=` — histórico paginado em ordem determinística.
- `POST /api/v1/inbox/conversations/:id/messages` — resposta pública do atendente; exige `Idempotency-Key` e status observável de envio.
- `POST /api/v1/inbox/conversations/:id/notes` — nota privada; não compartilha o contrato de envio externo.
- `PATCH /api/v1/inbox/conversations/:id/assignment` — atribui ou remove responsável, aceitando somente membro ativo do mesmo tenant.
- `PATCH /api/v1/inbox/conversations/:id/status` — muda para `open`, `pending` ou `resolved`.

Recebimento de canal não é endpoint público tenant-facing: adapter interno valida origem do evento, tenant do vínculo do canal, idempotência e identidade CRM antes de persistir. O contrato de persistência não permite que payload externo selecione o database.

## Gestão de contas e atendentes: dependência necessária

O produto atual permite criar um perfil Employee e alterar escopos de membros, mas não oferece no UI do tenant a concessão/revogação de memberships; também não cria identidades Keycloak. O Inbox não deve fingir que “Adicionar atendente” cria uma conta autenticada.

Para o MVP ser operável, o Product Gate deve cobrir o fluxo mínimo de associar ao tenant uma identidade existente e revogar seu acesso, ou declarar explicitamente um runbook operacional equivalente. Criação de identidade, convite, recuperação de senha e onboarding completo permanecem no fluxo de identidade/onboarding; não devem ser implementados como lógica paralela no Inbox. Somente um membro ativo pode ser atribuído a uma conversa.

## Contrato de canal e demonstração antes do WhatsApp

Como PRD-003 WhatsApp vem depois do Inbox, este módulo deve ser exercitável com um adapter fake determinístico em testes e demonstração. Eventos do canal precisam ser deduplicáveis por chave externa estável, preservar ordenação no histórico e tolerar retry. O adapter fake não deve ser tratado como provider de produção nem incluir envio real.

## Segurança, integridade e casos de borda

- Tenant e database são resolvidos server-side por autenticação, membership e registro confiável do Control Plane; nenhum ID de tenant enviado pelo cliente escolhe database.
- IDs de conversas, mensagens, pessoas, organizações, anexos, actors e eventos de outro tenant são negados ou retornam not found conforme contrato, sem revelar existência.
- Aplicar `customer_scope` também a contagens, filtros, busca, prévias, notificações realtime, atualização de estado, notas, envio e download de anexos.
- Eventos inbound/outbound têm chave de idempotência; retries não duplicam mensagens nem fazem uma mensagem desaparecer silenciosamente.
- Mensagens mantêm ordenação determinística mesmo com eventos simultâneos/atrasados; falhas de envio ficam visíveis e recuperáveis, sem alegar sucesso antes da confirmação disponível.
- Concorrência entre atendentes não deve apagar mensagens; conflitos de atribuição/estado mostram o estado atualizado e permitem nova tentativa.
- WebSocket valida autenticação, membership ativa, tenant e escopo na conexão e nos eventos; reconexão não depende do buffer realtime para recuperar dados.
- Uploads rejeitam conteúdo não permitido e nomes/caminhos fornecidos pelo usuário não controlam o destino de armazenamento.
- Mensagem privada/note nunca é encaminhada ao provider externo, inclusive em retries e serialização de eventos.

## Fora do MVP

SLA sofisticado, workforce management, presença/availability avançada, roteamento round-robin ou baseado em carga, equipes configuráveis, macros, automações genéricas, dashboards avançados, voice, múltiplos números WhatsApp por Basic, canais além dos explicitamente previstos no MVP, IA respondendo mensagens e analytics de performance por atendente.

## Critérios de aceite do Product Gate

- Usuário autenticado vê somente conversas de seu tenant e `customer_scope`, inclusive via busca, contagens, realtime e anexos.
- Atendente habilitado consegue abrir, atribuir/assumir, responder, adicionar nota interna, mudar estado e consultar histórico sem duplicação ou perda silenciosa.
- Admin e membro usam a mesma tela; ações respeitam papel e escopo no backend.
- Conversa aponta para Person/Organization canônica quando aplicável; criação de mensagem inbound não sobrescreve cadastro CRM confirmado.
- Fake channel demonstra recebimento, resposta, falha/retry e idempotência antes da integração WhatsApp real.
- Testes unitários, integração PostgreSQL, autorização/isolamento, ordenação/idempotência, realtime, anexos e componentes são criados junto a cada fatia e passam no CI.
- E2E Playwright permanece opt-in; quando necessário ao gate, script headless produz artefatos/logs legíveis que são revisados.
- Segurança revisada, fluxo demonstrável, evidência registrada e limites operacionais documentados.

## Referências

- [Escopo local do módulo Inbox](../../modules/inbox/AGENTS.md)
- [MVP da Syndes](./MVP-SCOPE.md)
- [Ordem dos módulos](./MODULE-ORDER.md)
- [CRM canônico e escopos de acesso](./PRD-001-CORE-CRM-SPEC.md)
- [Chatwoot: caixa compartilhada](https://www.chatwoot.com/features/shared-inbox)
- [Chatwoot: distinção entre inbox, equipe e responsável](https://www.chatwoot.com/hc/user-guide/articles/1677492970-adding-teams)
