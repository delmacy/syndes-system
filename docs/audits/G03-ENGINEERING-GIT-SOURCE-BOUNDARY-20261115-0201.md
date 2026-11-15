# G03 — Engenharia e Git: auditoria de fronteiras (2026-11-15 02:01 BRT)

## Proveniência
- Repositório: `delmacy/syndes-system`.
- Main consultada e comparada: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (comparação com `main`: identical, 0 ahead/behind antes da escrita).
- Branch exclusiva: `audit/g03-engineering-git-boundaries-20261115-0201`.
- Escopo: owner G03 do `catalog/work-units.json`, `path: AGENTS.md`, `maturity: distributed`. A maturidade do catálogo é taxonomia de ownership, **não** aceite, teste ou implantação.

## Contratos públicos e privados
- `AGENTS.md`: política global de classificação BLOCKER/BUG/MVP/POST-MVP; isolamento de tenant, autorização server-side, segredos, gates, revisão e CI. É contrato normativo, não implementação de API.
- `README.md`: main como linha canônica integrada; PRs curtos; documentação distingue integração técnica de deploy/homologação.
- `docs/engineering/MAINLINE-CI-POLICY.md`: PRs a partir da main, execução no merge sintético, matriz de impacto, gate agregado, release por SHA/digest e rollback. Confirma decisão expressa de manter main **sem proteção administrativa** nesta fase.
- `docs/engineering/TEST-STRATEGY.md`: compromissos de unit/integration/migrations/tenant isolation, stress/spike/soak em release isolado. Não prova execução.
- `scripts/ci/plan.mjs`: 15 entradas no catálogo, seleção por paths, modo full e fallback para noop quando nenhuma suíte impactada.
- `.github/workflows/syndes-ci.yml`: governança, impacto, matriz, paridade Support/Manager e gate final.

## Implementação, APIs, eventos, schema
- G03 é owner transversal de governança Git/engenharia; não foi identificada classe de domínio, endpoint HTTP, evento de negócio ou migration SQL **própria** nos arquivos inspecionados. Os módulos de produto mantêm ownership desses elementos.
- O planejador é interface CLI `plan.mjs impact <changed-files>` ou `full`, com funções exportadas `selectSuites` e `installedSuites`. A política e o workflow são superfícies públicas de engenharia; seleção interna por paths é detalhe de implementação.

## Divergências e limites
1. **G03-01 — lacuna de impacto por deleção (confirmada no YAML lido):** `git diff --name-only --diff-filter=ACMRT` omite status D, permitindo que exclusões puras escapem da seleção de suítes. Herda Q07/Q10; precisa correção e teste negativo, não duplicar issue sem reconciliação.
2. **G03-02 — gate não imposto administrativamente (decisão explícita, não defeito novo):** `main` sem branch protection; `Syndes CI Gate` não impede push/merge autorizado. Documentar como risco aceito, sem alterar configuração por iniciativa de auditoria.
3. **G03-03 — divergência documental interna:** `MAINLINE-CI-POLICY.md` ainda contém trecho histórico que descreve o check como exigido na proteção administrativa real da main, embora a mesma página e o README declarem a revogação posterior. Reescrever trecho histórico com data/contexto em tarefa documental separada, sem mudar a política vigente.
4. O contrato de `AGENTS.md` exige que testes sejam preservados; não foi comprovada execução dos 15 executores, dos reusable workflows ou dos gates no SHA da main desta rodada.
5. Nenhuma evidência de deploy/homologação, revisão humana integral ou SHA público de GitHub Pages foi inspecionada nesta rodada. Não inferir estado DONE.

## Evidências e testes não executados
- Leitura via GitHub MCP de `AGENTS.md`, `README.md`, `catalog/work-units.json`, `docs/engineering/MAINLINE-CI-POLICY.md`, `docs/engineering/TEST-STRATEGY.md`, `scripts/ci/plan.mjs`, `.github/workflows/syndes-ci.yml`.
- Não executados: testes unitários, regressões do planner, CI, builds, E2E, migrações, SQL, runtime, DevServer, carga, deploy ou rollback.
- Não examinados integralmente: assertions individuais de `scripts/ci/*.test.mjs`, todos os scripts executores, resultados Actions por SHA, PR reviews e publicação Pages.

## Próximo passo
Auditar G04 Privacidade após verificar novo head da main e eventuais branches concorrentes. Reconciliar G03-01 com Q07/Q10 e G03-03 na trilha de documentação. Manter estados `source exists`, `test passed` e `deployed/homologated` separados. Não integrar este checkpoint antes de revisão e evidência apropriada.
