# WBS — Gestão de Atendimentos no MVP (2026-11-11)

**Produto:** PRD-003A. **Área:** Gestão de Atendimentos; termo "Funil" = definição configurada, "Etapa" = posição, "Protocolo" = execução de atendimento. Source of truth separada do CRM, da Inbox e do Syndes Support.

| Prioridade | ID | Entrega e critério verificável | Dependência | Situação inicial |
|---|---|---|---|---|
| P0 | SM-01 | Baseline MVP, PRD-003A, ordem, WBS mestre e separação do WBS80 pós-MVP | Decisão produto 11/11 | **Código implementado; CI pendente** |
| P0 | SM-02A | Modelo tenant-local: funil configurável com etapas, protocolo por atendimento, vínculo opcional Inbox, estados e histórico append-only; idempotência e PK/FK por tenant/org/ws | Organizations/CRM/Inbox + SQL002 | **Implementado; PG17 14/14; CI pendente; sem deploy** |
| P0 | SM-02B | Serviço transacional: publicar funil simples, abrir protocolo, avançar etapa adjacente, atribuir funcionário ativo, fechar na etapa terminal; concorrência CAS | SM-02A | **Em execução, sem Host ativo** |
| P0 | SM-02C | PG17 com 2 tenant DBs, escopo org/workspace negativo, versão concorrente, append-only, vínculo Inbox, migration reaplicável e restore sintético | SM-02A/B | **Código implementado; CI pendente** |
| P0 | SM-02D | Registrar suite `service-management` no planner/runner da CI central, cobrindo npm check/build/test e PG17 segregado, sem duplicar workflows | Frente responsável pela CI e SM-02C | **Pendente — CI central ainda não executa os 14 testes novos** |
| P0 | SM-03A | Registrar novo módulo Nest no registry/installer, dependências e Control module entitlement ENABLED, sem bypass | SM-02C + installer e Control staging | Pendente |
| P0 | SM-03B | APIs REST seguras para criar, abrir, avançar, atribuir, concluir, listar e histórico; JWT, FGA, membership, 401/403/409 e escopo não forjável | SM-03A | Pendente |
| P0 | SM-04A | Workforce: usuários/equipes existentes, eligibility & membership, grants origem/destino e auditoria de transferência | Workforce DC-2c / SM-03 | Bloqueado |
| P1 | SM-04B | Transferência atômica entre equipes autorizadas no mesmo Workspace sem expor outros protocolos | SM-04A | Pendente |
| P1 | SM-05A | Inspector da Inbox: protocolo/etapa/responsável/histórico, sem duplicar mensagens ou alterar fontes canônicas | SM-03 + Inbox Product Gate | Pendente |
| P1 | SM-05B | Lista/Kanban por etapa com mesmo serviço e filtros autorizados, incluindo mobile e testes de navegadores | SM-05A | Pendente |
| P0 | SM-06A | Staging autorizado: backup/restore **real**, grants, tenant A/B, concorrência, idempotência e rollback de migration | Gates DR/Control/WA | Bloqueado |
| P0 | SM-06B | Produto: gestor e operador testam criação→atendimento→atribuição→mudança→conclusão→fila; Product Gate formal, métricas sem PII | SM-04/05/06A | Pendente |

**Fronteiras:** nenhuma UI até endpoint autorizado real; nenhuma extensão do estado da Inbox como motor de funil; sem templates, editor visual, BPMN ou SLA avançado (WBS80). Não renomear Support, nem assumir multidomínio org/workspace liberado. Não criar lógica de faturamento por execução.

**Regra de status:** `CODED != TESTED != INTEGRATED != OPERATIONAL != DONE`. Uma PR verde comprova apenas o que ela de fato testar. Release permanece condicionado a restore real homologado, identidade/tenant/Organization/Workspace, autorização, dados confiáveis e primeiro cliente pagante.
