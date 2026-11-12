# P14 — Platform Core | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

## Situação revalidada

modules/platform-core contém AGENTS.md e NÃO é pacote runtime próprio. O Core executável está distribuído em packages/core-kernel, apps/core-host e unidades Control/Identity/Authorization. Perfil de composição por instância ainda não foi implementado.

| Fonte | O que foi confirmado |
|---|---|
| `modules/platform-core/AGENTS.md` | Artefato presente no checkout; não implica runtime habilitado |
| `packages/core-kernel/package.json` | Artefato presente no checkout; não implica runtime habilitado |
| `packages/core-kernel/src/platform-events.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/core-host/src/module-host.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/core-host/src/platform-event-dispatcher.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/core-host/src/platform-event-worker-composition.ts` | Artefato presente no checkout; não implica runtime habilitado |
| `apps/core-host/config/modules.json` | Artefato presente no checkout; não implica runtime habilitado |

**Testes executados nesta revisão:** cd packages/core-kernel && npm test — 35 PASS; cd apps/core-host && npm test — 63 PASS, 0 FAIL, 19 SKIP.

## Bloqueios e limitações

- CMP-01/02: matriz de ports/contracts e schema offline de composição ainda pendentes na WBS.
- CMP-03–09: perfis de instância, imagens/rollout/entitlements e gates não homologados.
- Event Worker/scheduler, Control/tenant migrations, FGA service grants e restore real não ativados.
- 19 testes ignorados no Host NÃO são prova de integração PG17, staging, Keycloak ou FGA reais.

## Próximo marco candidato (não comprometido)

Especificar CMP-01 e CMP-02 preservando Kernel (ports), Host (composição) e módulos (domínio), sem habilitar worker ou perfis reais.

**Planejamento:** [Evolução](EVOLUCAO.md) · [Sprint](SPRINT.md) · [Escopo](ESCOPO.md).

## Checkpoint da auditoria

| Data | Ambiente | Evidência | Lacuna |
|---|---|---|---|
| 2026-11-12 | DevServer01 checkout `b452a03e` | Fonte e testes locais listados acima | Sem staging/CI da publicação, IAM real, restore e aceite |

## Registro anterior

A versão anterior deste STATUS era apenas um esqueleto documental sem auditoria funcional. Ela foi substituída pela inspeção parcial de código, testes e bloqueios acima, sem presumir operação homologada.
