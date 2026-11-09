# WBS — Syndes Support / #32
Versão 2026-11-09. Estados: `TODO`, `IN_PROGRESS`, `CODE`, `VERIFIED`, `BLOCKED`. `CODE` != `VERIFIED` != `DEPLOYED`. Todos os pacotes exigem artefato, aceite e teste antes de concluídos.

| WBS | Entrega / dependência | Evidência e critério de aceite | Estado |
|---|---|---|---|
| 1.1 | Inventário de branches, AGENTS, componentes (#27) | estado real de #21/#31/#32 documentado | VERIFIED |
| 1.2 | Baseline local e CI no HEAD de referência | saída de suites atuais preservada | VERIFIED (local; CI pendente) |
| 1.3 | Matriz de riscos e reuso | ADR + dependências, sem novos serviços | CODE |
| 2.1 | Caso, protocolo, ciclo de vida | PRD, schema e testes de estado | CODE |
| 2.2 | Contratos de API/status/erros | OpenAPI/tabela de rotas, teste de validação | VERIFIED (contrato e unit) |
| 2.3 | Filas, prioridade e assignment | invariantes tipo/fila e regra de transição testadas | CODE |
| 2.4 | Matriz de autorização e isolamento | deny cases por ator/tenant/fila/UUID | CODE |
| 2.5 | Migração aditiva e auditoria | PG real descartável, replay idempotente | CODE |
| 3.1 | Host e serviço fail-closed | tenant Syndes config + Keycloak/FGA antes de pool | VERIFIED (unit/HTTP) |
| 3.2 | Repositório e SQL isolados | consultas parametrizadas e atômicas | CODE |
| 3.3 | API listar/detalhar | paginação no SQL, sem vazamento | CODE |
| 3.4 | API criar/atribuir/transicionar/nota | validações, status, eventos auditados | CODE |
| 4.1 | Conta Whatsmeow Syndes exclusiva | owner verificado, sem conta de cliente | BLOCKED (provisionamento) |
| 4.2 | Vinculação CRM/Inbox a ticket externo | prova da conversa e contato no PG | CODE |
| 4.3 | Atendimento, transferência, fechamento/reabertura | operação autorizada + histórico | CODE |
| 4.4 | Notas invisíveis ao cliente | teste de negação de outbound e exposição | CODE |
| 5.1 | Formulário interno autenticado/API | requester derivado do token | CODE |
| 5.2 | Filas privadas + leitura do próprio ticket | escopo no SQL, tests negativos | CODE |
| 5.3 | Atribuição e acompanhamento auditados | testes de permissão/estados | CODE |
| 6.1 | Design de interface vinculada a API real | contrato por controle/estado/permission | VERIFIED (build/unit) |
| 6.2 | Lista e filtros permitidos | API e UI autorizadas, loading/error | CODE |
| 6.3 | Detalhe e linha temporal | sem dados de fora da fila | CODE |
| 6.4 | Solicitação interna | validação e feedback de erro | CODE |
| 7.1 | Unit tests de domínio | tipo, status, validações | VERIFIED |
| 7.2 | Integration tests em PG | migração, rollback de fixture, negativos | VERIFIED (PG real em CI) |
| 7.3 | Regressão de Kernel/Host/Inbox/WhatsApp/CRM | todas suites relevantes verdes | VERIFIED (local) |
| 7.4 | E2E de frontend | fluxos reais, sem backend fake | TODO |
| 7.5 | CI e revisão de isolamento | checks do HEAD, falhas explícitas | CODE (CI pendente) |
| 8.1 | Documentação técnica e operacional | PRD, ADR, API, runbook, testes | CODE |
| 8.2 | Branch/PR e checklist | preserva #27, sem merge indevido | CODE (PR #34 draft) |
| 8.3 | Homologação e deploy controlado | gate pessoal, backups, restore, grants | BLOCKED |
| 8.4 | Rollback, evidências e relatório final | sem migração destrutiva | CODE |
| 8.5 | Platform Manager agregado | contrato e autorização separados | BLOCKED (fora do PR) |

## Ordem executável / dependências
1. 1.1–1.3 e 2.1–2.5 antes de tocar o frontend.
2. 3.1–3.4 → 5.1–5.3; 4.1 + 4.2 → 4.3/4.4. Nenhuma tela funcional antes de endpoints testados.
3. 6.1–6.4 somente após 3–5 e matriz UI preenchida.
4. 7.1–7.5 contínuos a cada pacote, não só ao final.
5. 8.1/8.2 podem acompanhar desenvolvimento; 8.3 exige autorização explícita (e #31 quando aplicável).

## Matriz mínima de permissões
| Persona | Criar interno | Ler interno | Criar externo | Ler externo | Operar fila | Platform Manager |
|---|---|---|---|---|---|---|
| Solicitante interno autenticado (tenant Syndes) | com FGA internal/write | somente próprios, com FGA | não | não | não | não implícito |
| Agente fila interna | com FGA | próprios + fila cadastrada | não | não | membro e FGA | não implícito |
| Agente suporte externo | não automático | não | com FGA, fila e Inbox/CRM | somente fila | membro e FGA | não implícito |
| Administrador Platform Manager sem grant de suporte | não | não | não | não | não | agregados apenas por contrato futuro |
| Qualquer ator tenant comercial | não | não | não | não | não | não |

## Riscos/bloqueios
P0: base de integração #27 ainda draft; não fazer merge; ativação multi-org #31 proibida. P0: grants OpenFGA de suporte e memberships SQL precisam revisão/homologação. P1: conta dedicada WhatsApp Syndes ainda não verificada. P1: gestão de participação de filas requer runbook administrativo com trilha; não criar API improvisada. P1: CI local/PG do novo módulo exige prova própria. P2: SSE multi-réplica fora do scope; Platform Manager agregado e SLA demandam contrato aprovado.

## Registro por etapa
Atualizar este documento ou registro de entrega com: WBS, arquivos, testes, resultado, commit e PR; qualquer `TODO` não pode aparecer como `DONE` em relatório final.
