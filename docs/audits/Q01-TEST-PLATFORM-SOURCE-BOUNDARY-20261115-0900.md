# Q01 — Plataforma de testes: auditoria estática de fronteiras (2026-11-15 09:00 BRT)

## Base, owner e concorrência
- GitHub MCP confirmou `main@1cf48cc0a1281017ac58f7b9b9747f663109e151` por comparação `main...SHA` idêntica antes da criação da branch exclusiva `audit/q01-test-platform-source-20261115-0900`.
- `catalog/work-units.json` atribui Q01 a `tests`, maturidade `distributed`. É metadado de ownership, não aprovação de execução. I11 e I12 já possuem checkpoints em branches exclusivas; não foram alteradas.

## Contratos públicos/privados e implementação examinada
- `tests/AGENTS.md` estabelece pirâmide unit/integration/E2E/security/performance, testes negativos cross-tenant e invariantes de release: zero vazamento, acesso indevido, corrupção e perda silenciosa. São exigências, não evidências de sucesso.
- `scripts/ci/plan.mjs` exporta `catalog`, `selectSuites`, `installedSuites`; a CLI aceita modo impact/full e arquivo de caminhos alterados. O catálogo declara 15 suites potenciais, mas `installedSuites` só agenda marcadores presentes.
- `scripts/ci/plan.test.mjs` contém assertions para mudanças de docs, segurança, componentes novos, modo full, disponibilidade e dependências de CRM/Inbox/Support/WhatsApp.
- `.github/workflows/syndes-ci.yml` conecta foundation, impact, regression, duas paridades reutilizáveis e gate agregador. Em PR usa `git diff --name-only --diff-filter=ACMRT`; push main/merge_group/manual usa full.
- `scripts/ci/parity.test.mjs` verifica por leitura de arquivos a presença de workflows, scripts, comandos e proteções esperadas. Essa prova estática não equivale à execução de PostgreSQL, identidade, browsers ou suites reais.
- Q01 é orquestração de testes, sem API HTTP de negócio, classes de domínio, publicador de eventos ou migrations próprios identificados nos arquivos inspecionados. Testes referenciam schemas e serviços de outros owners, sem execução nesta auditoria.

## Divergências e limitações
- **Q01-01 (confirmada na fonte):** `--diff-filter=ACMRT` omite deleções no impacto de PR. A remoção de arquivo pode não selecionar as suites relevantes; a foundation continua executando, mas isso não comprova cobertura funcional. Reconciliar com Q07/Q10/G03, sem duplicar correções.
- **Q01-02 (limite de evidência):** presença de scripts e asserts estáticos não demonstra sucesso de CI no SHA atual, equivalência real das suites nem testes negativos em execução.
- **Q01-03 (risco de governança já aceito):** a política vigente mantém main sem proteção administrativa; gate verde não é bloqueio automático de integração.
- `tests/README.md` e `tests/integrity/repository-structure.test.mjs` retornaram 404; não presumir inexistência de documentação/testes equivalentes em outros caminhos. O workflow aponta `tests/integrity/repository-structure.sh`, ainda não auditado nesta rodada.
- **Testes executados: nenhum.** Nenhum DevServer acessado, Docker, SQL, migrations, runtime, secrets, workflow, código de produto ou deployment alterado. CI do SHA, homologação, Pages SHA público e review gates globais não verificados.

## Próximos gates
1. Auditar `tests/integrity/repository-structure.sh`, `scripts/ci/run-suite.sh`, `scripts/ci/run-infra.sh` e evidências CI por SHA, sem execução mutável.
2. Exigir teste negativo para deleção e corrigir filtro em fluxo de engenharia autorizado, não nesta branch documental.
3. Reconciliar Q01 com Q02–Q10, todos os 57 owners e novos owners descobertos; não declarar divergências zero, release ou Pages homologados.

## Escopo da alteração
Somente este novo Markdown na branch exclusiva; sem merge nem mutação de branches alheias.
