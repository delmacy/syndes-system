# WBS — Event Dispatcher / PR2

| ID | Entrega | Estado | Evidência / gate |
|---|---|---|---|
| EV-D01 | Registry de handlers confiáveis e assinaturas tipadas | Implementado, worktree | rejeita duplicados e id de módulo inconsistente |
| EV-D02 | Roteamento transacional para cada consumidor | Implementado, worktree | PostgreSQL 17: confirmação independente |
| EV-D03 | Claim concorrente com SKIP LOCKED e lease | Implementado, worktree | PostgreSQL 17: dois dispatchers e recuperação |
| EV-D04 | Consumer effect + consumer_inbox + ack no mesmo COMMIT | Implementado, worktree | testes de falhas e rollback |
| EV-D05 | Retry/backoff, suspensão e dead-letter lógico | Implementado com pendência | corrigir fail-closed recuperável em indisponibilidade de autorização |
| EV-D06 | Service principal e port de autorização explícito | Implementado com pendência | disponibilizar autorização real e módulo ENABLED; indisponibilidade não pode ser terminal |
| EV-D07 | Scheduler com tenant discovery, FGA e módulo ENABLED | Bloqueado | Control DB provisionado, Product Gate, backup/restore |
| EV-E00 | Compatibilidade do contrato de entrada WhatsApp | Pendente | `whatsapp_inbound_events.id` é bigint; contrato `inboundEventId` exige UUID |
| EV-E01 | WhatsApp inbound publica no mesmo COMMIT | Pendente PR3 | preservar legado textual |
| EV-E02 | Inbox consome e publica ParticipantObserved | Pendente PR3 | via contratos públicos |
| EV-E03 | CRM resolve identidade exata, Inbox revalida vínculo | Pendente PR3 | somente PG17 descartável |
| EV-P01 | Retenção e expurgo controlado | Bloqueado | política e backup/restore |
| EV-P02 | Deploy operacional, reprocessamento e vínculo no tenant real | Bloqueado | autorização, gates e homologação |

**Bloqueio de PR2:** o código candidato atual trata exception da autorização como `denied`/dead; isso viola recuperação em indisponibilidades transitórias. Um reparo com novos testes foi submetido ao controle de segurança da ferramenta, ainda não executado. Não integrar PR2 nem habilitar workers até esse cenário estar corrigido e coberto por PostgreSQL real.

**Distinção:** código local e testes locais não equivalem a CI aprovada, main atualizado, deploy ou homologação. PR1 #83 foi integrada ao main. Nenhuma base operacional foi modificada.
