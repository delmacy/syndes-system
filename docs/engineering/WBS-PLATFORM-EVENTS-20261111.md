# WBS — Transactional Outbox e Event Bus (2026-11-11)

| ID | Entrega | Situação | Gate |
|---|---|---|---|
| EV-A01 | Auditar kernel, provider, migrations, plugin modules e WA-DATA/CRM-WA | Executado | origin/main ae18af6, PR #82 já integrada |
| EV-B01 | Migration 001 platform_events com outbox/deliveries/consumer_inbox, FKs/índices | Implementado em worktree | PG17 descartável, sem aplicação operacional |
| EV-C01 | Port transacional com client PG fixado, verificação de database e rollback | Implementado em worktree | PG17 real e regressão |
| EV-C02 | Publisher tipado e idempotency-key com payload mínimo | Implementado em worktree | PG17 real e regressão |
| EV-D01 | Registry de consumidores e roteamento | Pendente | PR2 |
| EV-D02 | Claims concorrentes, leases, retries, dead-letter e recovery | Pendente | PR2 + PG17 |
| EV-D03 | Idempotência de efeitos, IAM de workers e module ENABLED | Pendente | PR2 + Control DB gate |
| EV-E01 | Evento WhatsApp inbound com publicação atômica | Pendente | PR3 |
| EV-E02 | Inbox consumer, participant observed e encaminhamento CRM | Pendente | PR3 |
| EV-E03 | ResolvePersonIdentity + result + link revalidation | Pendente | PR3, somente descartável |
| EV-F01 | Unit Core Kernel + Core Host + PG17 descartável | Implementado em worktree | Confirmar CI |
| EV-F02 | Regressões CRM/Inbox/WA/Organizations/Support + Go | Pendente para mudanças futuras | CI e suites locais |
| EV-G01 | ADR, WBS e AGENTS | Implementado em worktree | revisão |
| EV-P01 | Outbox Control Plane | Bloqueado | backup/restore Control DB e autorização |
| EV-P02 | Deploy operacional e reconciliação dos 14 contatos | Bloqueado | aceite específico |

**Estados são independentes:** implementado ≠ PR integrado ≠ implantado ≠ homologado. A migration não foi executada em nenhum tenant operacional. O atendimento textual e o processamento legado permanecem inalterados.

**Critério para PR1:** transação única com commit/rollback integral, dois tenants PG17 separados, proteção de escopo e idempotência concorrente. **Critério para PR2/PR3:** duas instâncias de dispatcher, falhas em cada instante, revival de lease, authz de service identity, módulo suspenso, link escopado de identidade existente e WhatsApp preservado durante indisponibilidade CRM.

**Próximo:** registrar PR1 e aguardar CI verde; depois implementar PR2 sequencialmente, sem alterar workflows.
