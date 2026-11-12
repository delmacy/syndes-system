# P03 — WhatsApp | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

## Situação revalidada

Pacote TypeScript com contas, outbox, inbound, dispatch, contratos e migrations 001–008; gateway Go/Whatsmeow existe. O plugin consta em apps/core-host/config/modules.json, mas a inscrição não prova módulo habilitado por tenant nem projetor novo operacional.

| Fonte | O que foi confirmado |
|---|---|
| `modules/whatsapp/package.json` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/whatsapp/src/plugin.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/whatsapp/src/outbox.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/whatsapp/src/event-bridge.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/whatsapp/gateway/whatsmeow/go.mod` | Artefato presente no checkout; não implica runtime habilitado |
| `modules/whatsapp/sql/008_whatsapp_projection_owner.sql` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/core-host/config/modules.json` | Artefato presente no checkout; não implica runtime habilitado |

**Testes executados nesta revisão:** cd modules/whatsapp && npm test — 69 PASS, 0 FAIL; testes Go não executados.

## Bloqueios e limitações

- Go/Whatsmeow: testes de gateway e persistência/quotas/contas não validados nesta auditoria.
- WA-CUT07–10: migration 008 em staging, todas instâncias legadas compatíveis com filtro, canário e rollback — não ativar projetores concorrentes.
- Grants FGA, identity service, tenant/org/workspace, restore e Control ENABLED reais permanecem gates.
- Escopo de entrega atual textual; mídia completa permanece fora desta fatia.

## Próximo marco candidato (não comprometido)

Homologar a rota textual segura por conta/tenant e preparar canário de projetor único apenas após restore real.

**Planejamento:** [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Escopo](ESCOPO.md).

## Checkpoint da auditoria

| Data | Ambiente | Evidência | Lacuna |
|---|---|---|---|
| 2026-11-12 | DevServer01 checkout `b452a03e` | Fonte e testes locais listados acima | Sem staging/CI da publicação, IAM real, restore e aceite |

## Registro anterior

A versão anterior deste STATUS era apenas um esqueleto documental sem auditoria funcional. Ela foi substituída pela inspeção parcial de código, testes e bloqueios acima, sem presumir operação homologada.
