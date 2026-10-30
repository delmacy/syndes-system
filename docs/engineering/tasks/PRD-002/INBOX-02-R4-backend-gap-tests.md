# INBOX-02-R4 — Testes funcionais de gaps backend e higiene de logs

- **Classificação:** `BUG`/`BLOCKER` de evidência
- **Owner executor:** OpenCode2 NVIDIA-only
- **Ownership:** `apps/api/src/modules/inbox/**` somente nos testes e código mínimo necessário; relatório nesta task

## Objetivo

Adicionar prova executável para os gaps G4/G6/G17/G18: ausência de secrets em auditoria/logs, anexos invalid/cross-tenant/path traversal, realtime authorization e channel dedupe/order/retry.

## Restrições

- Não enfraquecer testes existentes nem criar provider real.
- Manter isolamento A/B, customer_scope e TenantContext server-side.
- Se o comportamento já estiver coberto, apenas registrar a evidência e não duplicar testes.
- Não alterar frontend, billing, auth global, migrations não relacionadas, commit ou push.

## Aceite

- Specs reproduzíveis passam em ambiente descartável ou registram bloqueio ambiental.
- Logs de teste não contêm tokens, bodies privados ou credenciais.
- Lint, typecheck e testes do pacote passam.
