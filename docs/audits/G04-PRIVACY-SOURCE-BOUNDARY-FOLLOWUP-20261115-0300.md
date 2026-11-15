# G04 — Privacidade: complemento de auditoria de fronteiras (2026-11-15)

**Base de leitura:** main `1cf48cc0a1281017ac58f7b9b9747f663109e151`. **Branch exclusiva:** `audit/g04-privacy-boundary-followup-20261115-0300`. Checkpoint anterior: `audit/g04-privacy-20261113-1455` (base histórica `39314cd0`, 1 commit à frente e 16 atrás da main nesta consulta). Este documento não altera status canônico.

## Evidências GitHub verificadas

- `catalog/work-units.json` blob `d2aa27a13e30df16a28812f965577914430728b3`: ownership catalogado; maturity não equivale a execução/homologação. O checkpoint histórico atribui G04 a `tests/security`.
- `tests/security/AGENTS.md` blob `c47df40a1aba9e186698e93ac82b190c43c14294`: exige isolamento tenant, autorização, ID tampering, autenticidade/idempotência webhook, upload, secrets, ferramentas IA e fronteiras de sessão. Contrato normativo, não suíte executada.
- `modules/support/test/security.test.mjs` blob `66f2a2079126f30f4994a7611e411ccf7d3edba9`: assertions unitárias com kernel, FGA e DB simulados para tenant divergente, negação FGA, banco divergente, validação de IDs e filtragem SQL. Não demonstra política FGA real nem isolamento PG operacional; owner primário Support, evidência transversal reutilizável, não prova automática de G04.
- `docs/engineering/TEST-STRATEGY.md` blob `fd96ea8cc53f064b60deef5c6dd4921521c1726c`: exige testes de segurança e isolamento em PR; intenção de gate, sem resultado SHA.
- `docs/engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md`: contratos `platform.module.entitlement.changed.v1` e `platform.module.installation.changed.v1` minimizam payload, mas schema `control_events` e migration 006 são candidatos, não aplicados; não há expurgo automático e política de retenção depende de aprovação.
- `docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md`: fronteira Manager/Workspace, Control DB separado e autorização no servidor são decisões arquiteturais; sua implementação integral não foi demonstrada nesta auditoria.

## Contratos públicos/privados e fronteiras

**Públicos identificados por documentação:** contratos de eventos de módulo e fronteiras das APIs de Manager/Workspace. **Privados:** audit ledger Control, tenant DB por account, permissões internas e dependências de autorização. Não foi feito inventário exaustivo de controllers, DTOs, classes, consumidores, schemas SQL ou migrations associados a dados pessoais; não atribuir a G04 APIs ou tabelas de outros owners sem rastreabilidade. Eventos de Control não são eventos de negócio tenant.

**Lacunas abertas:** mapa de dados pessoais por endpoint/tabela/evento, política verificável de retenção/eliminação/exportação, teste de acesso/isolamento backend integrado, comprovação de CI por SHA, revisão LGPD e gates de produto. Não afirmar ausência de implementação por falta de inventário, nem conformidade por presença de contrato.

## Execução e limites

Nenhum teste executado; CI, Pages, deploy e homologação não verificados. Sem DevServer, runtime, SQL, migrations, credenciais, workflows, deploy ou edição de branches de terceiros. Nenhum merge solicitado. **Estado:** checkpoint documental parcial; divergências de rastreabilidade permanecem abertas. Próximo owner não auditado: G05 somente após reconciliar checkpoints históricos e atualidade do catálogo.
