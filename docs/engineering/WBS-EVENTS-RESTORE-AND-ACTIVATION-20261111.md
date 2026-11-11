# WBS — Recuperação e ativação de eventos (2026-11-11)

| Prioridade | ID | Resultado | Situação |
|---|---|---|---|
| P0 | EV-DR01 | Script de backup/restore PG17 isolado com dados sintéticos, `--network none` e alvo fixo | **Implementado, ensaio aprovado** |
| P0 | EV-DR02 | Comparar Control audit/outbox, tenant outbox/deliveries/consumer_inbox e triggers/constraints após restore | **Testado em PG17 descartável** |
| P0 | EV-DR03 | Verificar checksum, restauração transacional, ACL Control e idempotência após recuperação | **Testado em PG17 descartável** |
| P0 | EV-DR04 | Testar restore real de backups de Control e tenant em área segregada, com evidência de escopo, segurança, roles e RTO/RPO | **Bloqueado: autorização e plano de janela** |
| P0 | EV-ST01 | Aplicar Control migrations 001–006 em staging homologado | **Bloqueado por EV-DR04 e gates** |
| P0 | EV-ST02 | Aplicar `platform_events` migrations 001–002 no tenant de staging, com prova de rollback | **Bloqueado por EV-DR04 e gates** |
| P0 | EV-ST03 | Provisionar identidade técnica, FGA/ENABLED, ACL de delivery, descoberta de tenants e dispatcher com ciclo de vida | **Pendente; sem tocar produção** |
| P1 | EV-ST04 | Ensaio de cutover WhatsApp textual (projetor legado vs novo, sem duplicar) e rollback | **Pendente** |
| P1 | EV-UX01 | Revisão visual do Workspace e Manager com requisitos atuais, sem inventar menus/telas | **Disponível localmente; acesso HTTPS Tailnet do usuário a validar** |
| P1 | EV-UX02 | Teste autenticado de mensagem → Inbox → CRM → vínculo e recuperação CRM indisponível | **Pendente de EV-ST01–04** |
| P2 | EV-OP01 | Monitoramento, retenção, dead-letter/review e runbook de incidentes | **Pendente** |

**Contagem remanescente:** o frontend já pode ser visualizado independentemente. Para comprovar o fluxo integrado na UI ainda restam quatro marcos: (1) restore operacional testado e migrations em staging; (2) worker/autorização; (3) cutover seguro; (4) smoke autenticado e Product Gate. O ensaio sintético é uma evidência preparatória, **não fecha o marco 1**.

**Restrições:** `syndes_control` e databases de tenant operacionais não foram escritos; SQL002/multi-org, GitHub Actions, branch protection, frontend de outros chats, roteamento Tailscale e dados dos 14 contatos permaneceram intocados. Os serviços textuais existentes continuam ativos.

Ver `docs/engineering/ADR-EVENTS-DISPOSABLE-RESTORE-DRILL-20261111.md` e `docs/engineering/WBS-EVENTS-STAGING-UI-READINESS-20261111.md`.
