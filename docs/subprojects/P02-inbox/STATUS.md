# P02 — Inbox | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

## Situação revalidada

Plugin NestJS, fila, responsável, handoff, notas, mensagens, SSE e consumidores opt-in de evento WhatsApp/CRM. A operação autenticada e o layout real ainda exigem homologação.

| Fonte | O que foi confirmado |
|---|---|
| `modules/inbox/package.json` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/inbox/src/plugin.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/inbox/src/inbox.controller.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/inbox/src/realtime.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/inbox/src/whatsapp-event-consumer.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/inbox/src/crm-link-event-consumer.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/workspace-web/src/features/inbox.tsx` | Artefato presente no checkout; não implica runtime habilitado |

**Testes executados nesta revisão:** cd modules/inbox && npm test — 34 PASS, 0 FAIL.

## Bloqueios e limitações

- WBS 50.03: testar fila/handoff/resposta em browser com JWT Keycloak, FGA e tenant/workspace reais.
- WBS 50.04: reproduzir identificação de contato e layout compacto em navegador antes de marcar correção concluída.
- SSE em memória não é barramento replicado; consumers de eventos opt-in não garantem que o worker esteja rodando.
- SQL 002 continua ativo; transferências e paths tenant-only legados exigem novo gate.

## Próximo marco candidato (não comprometido)

Reproduzir a jornada Inbox autenticada com contato identificado, fila e atribuição; depois validar a ponte WhatsApp e CRM.

**Planejamento:** [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Escopo](ESCOPO.md).

## Checkpoint da auditoria

| Data | Ambiente | Evidência | Lacuna |
|---|---|---|---|
| 2026-11-12 | DevServer01 checkout `b452a03e` | Fonte e testes locais listados acima | Sem staging/CI da publicação, IAM real, restore e aceite |

## Registro anterior

A versão anterior deste STATUS era apenas um esqueleto documental sem auditoria funcional. Ela foi substituída pela inspeção parcial de código, testes e bloqueios acima, sem presumir operação homologada.
