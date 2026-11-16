# P02 — Inbox | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

## Checkpoint da Ficha Mestre e reconciliação — 16/11/2026

Criadas a [Ficha Mestre P02](FICHA-MODULO.md) com 22 seções, a [matriz de 19 ações](MATRIZ-ACOES.md) (17 HTTP + 2 eventos), [inventário técnico](INVENTARIO-TECNICO.md), [diagramas](DIAGRAMAS.md) e 19 fichas A–J com edge cases e testes **propostos**. Código de referência `24018b354392196899332af1581170fb3ad7cf24`.

**Os 34 PASS são históricos de 12/11, checkout `b452a03e`, não reexecutados nesta atualização documental.** Não alteramos comportamento, grants, migrations, workers ou servidores. **Product Gate e E2E Keycloak/OpenFGA/tenant A/B continuam abertos.** Risco de paridade SQL: a migration 001 base não contém todos os campos usados pelo código atual, o que exige rastrear 002/migrations de outros owners antes de qualquer deploy.

## Evidência de paridade — 16/11/2026

[PARIDADE-CODIGO.md](PARIDADE-CODIGO.md) confronta o código com as fichas, identifica as migrations dos seus respectivos owners e registra as diferenças de CRM manual/consumer, responsável, favoritos, marcar lida e SSE. **Nenhuma melhoria de comportamento foi implementada ou aprovada.**

**CI mais recente e separada da auditoria histórica:** [Mainline run 43930160944](https://github.com/delmacy/syndes-system/actions/runs/43930160944), SHA `54bbc6c`, job **Regression / inbox** concluído com sucesso: logs mostram **9 testes PASS, 0 FAIL** no contrato Host + PostgreSQL de teste. Não é homologação de Keycloak/OpenFGA reais nem provider WhatsApp. [Docs run 43930160900](https://github.com/delmacy/syndes-system/actions/runs/43930160900): 18 testes de conteúdo, 12 mobile, deploy aprovado — não avalia runtime Inbox.

**Propriedade SQL confirmada no repositório:** `002_legacy_single_context_gate.sql` e `003_legacy_ownership.sql` pertencem a **P04 Organizations**; `005_whatsapp_history.sql` pertence a **P03 WhatsApp**; o plugin P02 declara só `001_inbox_foundation`. Aplicação/ordem/backfill/restore **não verificados em ambiente**.

## Incremento P02-ASSIGN-01 — 16/11/2026 (código novo)

**Aprovação:** solicitação explícita do proprietário para implementar elegibilidade de destinatário. **Mudanças de código:** `InboxService.assign` preserva o gate do ator; `PgInboxRepository.assign` exige dentro da mesma instrução SQL P04 memberships ativas `admin/editor` na organização/workspace atuais, organização e workspace ativos; recusa visitante, revogado, desconhecido ou outro escopo. `null` libera atribuição. Não adiciona migration nem permissão, não cria cadastro duplicado de operador.

**Testes escritos:** PG17 descartável `pg-org-scope.mjs` e `pg-integration.mjs`, HTTP Host com verifier/FGA de teste e teste unitário SQL; **execução e contagem de PASS aguardam a CI da SHA deste incremento**. Não substituir a evidência histórica abaixo. **Não foi realizado deploy no DevServer01 ou homologação Keycloak/OpenFGA reais.**

**Trade-offs registrados:** invalid recipient retorna 404 genérico; role elegível é `editor/admin` de P04 (não valida grants individuais FGA do destinatário); atribuições antigas inválidas não são saneadas; migrations P04 de escopo/ownership e backfill são pré-requisitos. [Ficha da ação](acoes/p02-assignment-set.md) e [paridade](PARIDADE-CODIGO.md).

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

**Testes históricos na auditoria de 12/11 (checkout `b452a03e`):** `cd modules/inbox && npm test` — 34 PASS, 0 FAIL. **Não reexecutados manualmente na reconciliação documental de 16/11**; CI mais recente de escopo distinto registrada acima.

## Bloqueios e limitações

- WBS 50.03: testar fila/handoff/resposta em browser com JWT Keycloak, FGA e tenant/workspace reais.
- WBS 50.04: reproduzir identificação de contato e layout compacto em navegador antes de marcar correção concluída.
- SSE em memória não é barramento replicado; consumers de eventos opt-in não garantem que o worker esteja rodando.
- O índice-gate SQL 002 existe como migration em P04, mas a sua **aplicação em ambiente não foi verificada**; transferências e paths tenant-only legados exigem gate auditado.

## Próximo marco candidato (não comprometido)

Reproduzir a jornada Inbox autenticada com contato identificado, fila e atribuição; depois validar a ponte WhatsApp e CRM.

**Planejamento:** [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Escopo](ESCOPO.md).

## Checkpoint da auditoria

| Data | Ambiente | Evidência | Lacuna |
|---|---|---|---|
| 2026-11-12 | DevServer01 checkout `b452a03e` | Fonte e testes locais listados acima | Sem staging/CI da publicação, IAM real, restore e aceite |

## Registro anterior

A versão anterior deste STATUS era apenas um esqueleto documental sem auditoria funcional. Ela foi substituída pela inspeção parcial de código, testes e bloqueios acima, sem presumir operação homologada.
