# WBS — Gestão de Atendimentos no MVP (2026-11-11)

**Produto:** PRD-003A. **Área:** Gestão de Atendimentos; termo "Funil" = definição configurada, "Etapa" = posição, "Protocolo" = execução de atendimento. Source of truth separada do CRM, da Inbox e do Syndes Support.

| Prioridade | ID | Entrega e critério verificável | Dependência | Situação inicial |
|---|---|---|---|---|
| P0 | SM-01 | Baseline MVP, PRD-003A, ordem, WBS mestre e separação do WBS80 pós-MVP | Decisão produto 11/11 | **Integrado no main pela PR #93** |
| P0 | SM-02A | Modelo tenant-local: funil configurável com etapas, protocolo por atendimento, vínculo opcional Inbox, estados e histórico append-only; idempotência e PK/FK por tenant/org/ws | Organizations/CRM/Inbox + SQL002 | **Domínio no main PR #93; PG17 14/14; sem deploy** |
| P0 | SM-02B | Serviço transacional: publicar funil simples, abrir protocolo, avançar etapa adjacente, atribuir funcionário ativo, fechar na etapa terminal; concorrência CAS | SM-02A | **Domínio no main; plugin Host opt-in em preparação; sem Host ativo** |
| P0 | SM-02C | PG17 com 2 tenant DBs, escopo org/workspace negativo, versão concorrente, append-only, vínculo Inbox, migration reaplicável e restore sintético | SM-02A/B | **PG17 A/B e rollback de preflight sem Workforce 007 aprovados localmente; automação central pendente** |
| P0 | SM-02D | Registrar suite `service-management` no planner/runner da CI central, cobrindo versão 0.2.0, 18 testes HTTP/PG17 + Workforce manual 007, sem duplicar workflows | Frente responsável pela CI e SM-02C | **Pendente — Issue #94; atualizar para suíte HTTP+PG17+Workforce 007 (18 testes)** |
| P0 | SM-03A | Registrar descritor/plugin Nest e migration no instalador; gate ENFORCE/ENABLED obrigatório no Control; ativação somente após homologação | SM-02C + installer e Control staging | **Código opt-in pronto e testado localmente; Control operacional/installer pendentes** |
| P0 | SM-03B | APIs REST de criar/abrir/avançar/atribuir/concluir/listar/histórico; OIDC/FGA+ENABLED+membership, 401/403/409/503, E2E com identidade real | SM-03A | **Controller HTTP implementado como plugin não montado; testes Nest sintéticos aprovados, smoke real pendente** |
| P0 | SM-04A | Workforce: equipes existentes, ligação ativa CRM/Staff, elegibilidade e grants FGA origem/destino, auditoria | Workforce DC-2c/007 + SM-03 | **Código implementado e PG17 sintético testado; Workforce 007 operacional/FGA/restore bloqueados** |
| P1 | SM-04B | Transferência CAS entre equipes staffed do mesmo Workspace, motivo/auditoria e revogação de visibilidade na origem | SM-04A | **Código/API/PG17 testados; não ativado; CI e staging pendentes** |
| P1 | SM-05A | Inspector da Inbox: protocolo/etapa/responsável/histórico, sem duplicar mensagens ou alterar fontes canônicas | SM-03 + Inbox Product Gate | Pendente |
| P1 | SM-05B | Lista/Kanban por etapa com mesmo serviço e filtros autorizados, incluindo mobile e testes de navegadores | SM-05A | Pendente |
| P0 | SM-06A | Staging autorizado: backup/restore **real**, grants, tenant A/B, concorrência, idempotência e rollback de migration | Gates DR/Control/WA | Bloqueado |
| P0 | SM-06B | Produto: gestor e operador testam criação→atendimento→atribuição→mudança→conclusão→fila; Product Gate formal, métricas sem PII | SM-04/05/06A | Pendente |

A migração aditiva `002_service_team_transfer.sql` depende da migration **manual** `modules/organizations/sql/007_staff_roles_pre_release.sql` e das FGA tuples por equipe. Nenhum banco real recebeu a migration. O módulo evolui para **0.2.0**; Control entitlement e ledger de migração ainda precisam ser homologados. Ver `ADR-SERVICE-WORKFORCE-TEAM-TRANSFER-20261111.md`.

**Fronteiras:** nenhuma UI até endpoint autorizado real; nenhuma extensão do estado da Inbox como motor de funil; sem templates, editor visual, BPMN ou SLA avançado (WBS80). Não renomear Support, nem assumir multidomínio org/workspace liberado. Não criar lógica de faturamento por execução.

**Regra de status:** `CODED != TESTED != INTEGRATED != OPERATIONAL != DONE`. Uma PR verde comprova apenas o que ela de fato testar. Release permanece condicionado a restore real homologado, identidade/tenant/Organization/Workspace, autorização, dados confiáveis e primeiro cliente pagante.
