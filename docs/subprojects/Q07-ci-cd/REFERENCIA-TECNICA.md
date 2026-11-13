# Q07 — CI/CD | Referência técnica

> **AUDITORIA E CORREÇÃO LOCAL — 12/11/2026.** Base `origin/main` SHA `9521919178bcc0341c4d187492f9d027d188a6bd`. Scripts de CI corrigidos em worktree isolada, com suites reais executadas localmente. **CI mainline concluída com sucesso no SHA `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f` ([run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873), 24/24 jobs success).** Não equivale a Product Gate nem deploy.

## Stack e ownership

- **Owner Q07:** `scripts/ci/plan.mjs` no catálogo; código JavaScript ESM/Node 22, Bash e GitHub Actions YAML.
- **Orquestrador:** `.github/workflows/syndes-ci.yml` executa `foundation`, `impact`, `regression`, duas paridades reutilizáveis e `gate`.
- **Automação separada:** `syndes-docs-pages.yml` publica Docs, `syndes-docs-project-sync.yml` sincroniza Issues/Projects quando autorizado, sem duplicar regressão PR.
- **Executores:** `scripts/ci/run-suite.sh`, `run-infra.sh`, `run-account-access.sh`, `run-workspace-browser.sh`.
- **Testes:** `scripts/ci/parity.test.mjs`, `plan.test.mjs`, `tests/integrity/repository-structure.sh`.

## Funções, comandos e artefatos

| Declaração | Arquivo | Contrato verificado |
|---|---|---|
| `catalog` | `scripts/ci/plan.mjs` | 15 suites instaláveis com identificador, marker e runtime Node/Go |
| `selectSuites(changedPaths, available, mode)` | `scripts/ci/plan.mjs` | `impact`/ `full` → array de `{suite,node}`; mudança desconhecida faz full |
| `installedSuites(base)` | `scripts/ci/plan.mjs` | Identifica suites por lockfile, go.mod ou marker de infra |
| `mainlineEvents(source)` | `scripts/ci/parity.test.mjs` | Classifica `push`, `pull_request`, `merge_group` nos cinco workflows explicitamente aceitos |
| `bash scripts/ci/run-suite.sh service-management` | `scripts/ci/run-suite.sh` | Build Kernel, npm ci/check/test/pack do Serviço e PG17 descartável |
| `start_pg(name,port,password,version,label?)` | `scripts/ci/run-suite.sh` | Inicializa PostgreSQL apenas de teste com label opcional e `trap` de limpeza |
| `node --test scripts/ci/*.test.mjs` | Planner/paridade | 19/19 testes localmente, sem skipped |
| `node scripts/ci/plan.mjs full` | Planner | Matriz completa instalada com 15 suites, incluindo Serviço |

### Suíte `service-management`

Marcador `modules/service-management/package-lock.json`, dependência do `@syndes/core-kernel`. O teste exige `postgres:17-alpine` descartável e valida módulo **não montado por padrão no Host**, FGA/ENABLED, tenant/workspace, protocolos, equipes e auditoria. O runner define marcador `SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY` apenas no ensaio. **Local: 19 testes PASS**, inclusive a fixture PG17. Não usar essas configurações para produção.

## APIs, contratos e dependências

**Q07 não publica API HTTP, eventos do domínio nem banco operacional.** Seu contrato público para GitHub Actions é a matriz JSON `{"include":[{"suite":"...", "node":"..."}]}`, os exit codes, logs de jobs e o `Syndes CI Gate`. Não modificar contratos públicos de P01/P02/P03/P05 para corrigir seleção.

- **Impacto CRM:** seleciona Serviço, Inbox, Host, Workspace, Support e CRM.
- **Impacto Inbox:** inclui Serviço, WhatsApp TS e consumidores.
- **Impacto Serviço:** seleciona Serviço, Inbox, Host e Workspace.
- **Kernel/infra/Host/security/CI:** regressão full; docs-only continua sem regressões de negócio desnecessárias, mas com foundation.
- **Fail closed:** modos desconhecidos produzem erro; `gate` deve reprovar `failure`, `cancelled` ou `skipped` requerido.

## Frontend e persistência

Q07 **não possui frontend, schema SQL ou migration próprios**. GitHub Actions e Syndes Docs são as interfaces de acompanhamento; o PG17 da suite Serviço é temporário e não substitui tenant real. Não publicar dados sensíveis, tokens, endpoints administrativos nem senhas de ambientes operacionais.

## Evidências e pendências

- **Antes:** [mainline CI de Q10](https://github.com/delmacy/syndes-system/actions/runs/43337290670) falhou porque `parity.test.mjs` exigia exatamente três workflows, mas Docs Pages e Projects Sync ampliaram para cinco.
- **Depois local:** `node --test scripts/ci/*.test.mjs` 19/19 PASS; `bash tests/integrity/repository-structure.sh` PASS; `bash -n scripts/ci/*.sh` PASS; `service-management` PG17 19/19 PASS; `mkdocs build --strict` a validar na mesma revisão.
- **Depois remoto:** [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873) do commit `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f`: **24/24 jobs success**, incluído `Syndes CI Gate`. Evidência válida somente para essa revisão e ambientes descartáveis do CI.

[Escopo e matrizes Q07](ESCOPO.md) · [STATUS](STATUS.md) · [WBS](EVOLUCAO.md).
