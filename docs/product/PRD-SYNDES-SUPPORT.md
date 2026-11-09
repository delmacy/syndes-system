# PRD — Syndes Support (Issue #32)
Status: contrato proposto em branch isolada; não homologado nem implantado. Data: 2026-11-09.

## Finalidade e fronteira de produto
Central de chamados **do próprio Syndes** para dois públicos segregados: suporte externo (prospects, contratantes e seus representantes) e solicitações internas (colaboradores). Não é helpdesk fornecido automaticamente aos tenants comerciais. Respeitar o tenant operacional Syndes, CRM, Inbox e Whatsmeow existentes. Tenant comercial relacionado é apenas referência, nunca seleção de base.

## Requisitos e rastreabilidade
| ID | Requisito | WBS | Critério de aceite |
|---|---|---|---|
| SUP-01 | Identidade Syndes e limite rígido de tenant | 2.4/3.1 | tenant diferente nega antes de resolver banco |
| SUP-02 | Case: UUID, protocolo, público, canal, solicitante, referência comercial opcional, fila, assignee, prioridade, estado e timestamps | 2.1/3.2 | SQL, API e validações coincidem |
| SUP-03 | Filas separadas: external/general; internal/it_infra, product, operations, administrative | 2.3/5.1 | fila de tipo distinto jamais aceita ticket |
| SUP-04 | Solicitação interna com identidade Keycloak do requerente | 5.1 | requester vem do JWT, nunca do body |
| SUP-05 | Operação humana externa vinculada a conversa da Inbox e contato CRM Syndes | 4.1/4.2 | conversa/account pertence ao tenant/escopo Syndes |
| SUP-06 | Listar/detalhar apenas tickets próprios (internos) ou da fila explicitamente autorizada | 3.3/5.2 | UUID estrangeiro não revela existência |
| SUP-07 | Atribuir, transferir fila, transicionar, fechar, reabrir; tudo auditado | 3.4/4.3/5.3 | autorização server-side, histórico atômico |
| SUP-08 | Notas internas nunca publicadas ao canal externo | 4.4 | somente retorno autenticado de ticket; sem outbound |
| SUP-09 | Frontend somente para rotas reais; sem dados simulados | 6.1–6.4 | contrato, permission check, erros e testes |
| SUP-10 | Testes isolados, negativa de autorização, PG, regressão, E2E, CI e rollback | 7.1–8.4 | nenhum CHECK falhando, sem deploy automático |
| SUP-11 | Platform Manager só agregados de acesso explícito, sem transcrições | 8.5 | contrato/review separado, não incluir nesta implementação |

## Decisões P0
- Suporte externo inicia **pela conta WhatsApp dedicada Syndes**; agente usa a Inbox existente para histórico/resposta. A abertura do Case só pode referenciar conversa existente e escopada; não criar segundo chat.
- Ticket externo é criado por operador autenticado após validação da conversa/contato. Ingestão automática Whatsmeow→Case e autoabertura futura **não devem ser simuladas** antes de seu contrato de idempotência.
- Interno abre formulário com Keycloak; a origem é `form`. Público externo via WhatsApp é `whatsapp`. Não oferecer endpoint de criação anônima.
- Filas são registros persistentes com `kind`; associação de operadores a filas é administrada por processo restrito/auditado, nunca por permissão implícita de platform admin. Membros podem atuar só onde vinculados.
- Protocolo numérico sequencial é interno e **não é token de autorização**. IDs não são publicados sem autenticação.
- Referência comercial opcional é identificador, sem join com tenant comercial. Não usar dados de outro banco.
- Status: `new`, `triage`, `in_progress`, `waiting_customer`, `resolved`, `closed`; reabertura explícita de resolvido/fechado para triagem. Em tickets internos, `waiting_customer` significa aguardando solicitante.
- Notas internas ficam no registro auditável do ticket. Não são mensagens de Inbox nem respostas pelo WhatsApp.

## Exclusões e bloqueios
Nenhum Chatwoot/Jira novo, IA, omnichannel, billing, SLA garantido, analytics ou botão fictício. O indicador de chamados vencidos exige regra de SLA aprovada — não inventar. Cadastro/grants de operadores, identidade do tenant Sydnes e conta dedicada devem ser verificados em homologação. Nenhum deploy enquanto #31 estiver bloqueado para operação multi-org; o Support em tenant único não depende de abrir SQL 002.
