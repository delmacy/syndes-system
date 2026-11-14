# Q02 — Testes unitários: auditoria de contratos e limites (2026-11-14 14:56 BRT)

- Owner: Q02, catálogo `catalog/work-units.json` (`path: modules`, `maturity: distributed`).
- Baseline GitHub main verificada por comparação: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (identical ao main no início).
- Escopo: inspeção estática via GitHub MCP, sem DevServer, execução ou mutação de produto.

## Evidência de fonte e contratos

- `modules/core-crm/package.json`: `test = npm run build && node --test test/*.test.mjs`; `check = tsc --noEmit -p tsconfig.json`; exports `.` e `./plugin`. A suíte unitária pertence ao módulo CRM; não a Q02 como serviço.
- `modules/inbox/package.json`: mesma convenção de testes e check; `test:ui = node --test test/frontend.test.mjs`. A classificação real de `frontend.test.mjs` (unit vs integração) depende de leitura das assertions.
- `modules/whatsapp/package.json`: `test = npm run build && node --test test/*.test.mjs`; exports incluem contratos, plugin, event-bridge, event-route-commands e event-identity-reader. Os testes não foram lidos individualmente, logo nenhuma cobertura de eventos/idempotência está demonstrada.
- `apps/core-host/package.json`: `test = npm run link-peers && npm run build && node --test test/*.test.mjs`. Testes de Host podem ser integração e não devem ser contabilizados automaticamente como Q02.
- `apps/master-admin-api/package.json`: `test = node --test test/*.test.mjs`. Sem inspeção dos arquivos de teste, não se pode afirmar cobertura de autenticação/autorização.
- `docs/engineering/TEST-STRATEGY.md`: diferencia unit tests rápidos de integração, migrations, tenant isolation, authorization e security checks de PR; performance pesada é gate de release.
- `docs/engineering/MAINLINE-CI-POLICY.md`: suites selecionadas por impacto, gate agregado, full em push main; aprovação de CI não é homologação nem branch protection.

## Fronteiras e lacunas

- Q02 é responsabilidade transversal de verificação; não possui API HTTP, classes de domínio, eventos próprios, tabelas ou migrations próprios identificados nesta amostra. Esses contratos pertencem aos módulos sob teste.
- A existência de scripts `test` não prova execução, cobertura, isolamento, assertions, resultado PASS ou equivalência do SHA. Não foram lidos os testes individuais, as implementações dos módulos nem seus fixtures/mocks.
- As referências a schemas/migrations e rotas não foram auditadas neste checkpoint; verificar no próximo ciclo testes negativos de autorização, isolamento de tenant, eventos, idempotência e rollback, sempre vinculando evidência ao commit testado.
- `catalog/work-units.json` mantém 57 owners; esta auditoria não reconcilia cada um nem owners novos. `maturity` do catálogo não equivale a deploy/homologação.
- `docs/subprojects/Q02/STATUS.md` não foi encontrado no caminho consultado (404); não implica ausência de documentação em outros caminhos.
- A busca indexada por `Q02` e `unit test` retornou zero resultados; os arquivos acima foram lidos por caminho conhecido. Não interpretar busca vazia como ausência de código.

## Estado e gates

Fonte de scripts: **verificada estaticamente**; assertions/cobertura: **não auditadas**; testes executados nesta rodada: **zero**; CI vinculada ao SHA: **não verificada**; integração/deploy/homologação: **não comprovados**; GitHub Pages público SHA: **não confirmado**.

Nenhuma alteração de runtime, SQL, migrations, workflows, secrets, CI, outras branches ou DevServer. Checkpoint isolado para revisão; não autoriza merge nem promoção de estado. Próximo owner: Q03 Integração, após aprofundar as assertions Q02.
