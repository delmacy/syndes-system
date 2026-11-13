# Q01 — Plataforma de testes | Referência técnica

> **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** Checkout `origin/main` SHA `bd0aa69349879485156ce05ffcb211904d34c206`, DevServer01/worktree isolada. Q01 não é app/backend: sua fonte canônica é `tests/` e os testes executáveis do Syndes estão distribuídos pelos módulos. O [CI no SHA auditado](https://github.com/delmacy/syndes-system/actions/runs/43340637846) passou **24/24 jobs**, em ambientes de ensaio.

## Stack, arquivos e ownership

- **Test runner:** Bash, Python e Node.js ESM, com Docker Compose/containers de PostgreSQL 16/17 conforme cenário, Keycloak, OpenFGA e OpenBao descartáveis. Ferramentas e versões variam pelo job do Q07; não existe um `package.json` central em `tests/`.
- **Q01:** `tests/AGENTS.md`, `tests/platform/*`, `tests/integration/AGENTS.md`, `tests/security/AGENTS.md` e `tests/performance/AGENTS.md`; as subáreas de testes têm owners específicos.
- **Q10:** `tests/integrity/repository-structure.sh` e `AGENTS.md`.
- **Q07:** `.github/workflows/syndes-ci.yml`, `scripts/ci/plan.mjs`, `run-suite.sh`.
- **Owners de produto:** `modules/*/test`, `apps/*/test` e suites próprias; Q01 não absorve seus contratos.

## Funções, comandos e verificações identificáveis

| Declaração / comando | Fonte | Efeito/limite |
|---|---|---|
| `bash tests/integrity/repository-structure.sh` | `tests/integrity` | Verifica arquivos/AGENTS e catálogo de 57 unidades |
| `bash scripts/ci/run-suite.sh infra` | `scripts/ci/run-suite.sh` | Chama `run-infra.sh` com lifecycle descartável; **não executar em host compartilhado sem isolamento** |
| `bash tests/platform/postgres-smoke.sh` | `tests/platform/postgres-smoke.sh` | `pg_isready`, DB Control/Identity, roles/tenant e restore sintético |
| `fga()`, `check()` | `tests/platform/openfga-smoke.sh` | Chamadas a OpenFGA de CI e verificação allow/deny |
| `bao_http()`, `unseal()` | `tests/platform/openbao-smoke.sh` | Health/TLS e lifecycle de secretos descartáveis |
| `run(*args, env=None, check=True, timeout=80)` | `tests/platform/platform-manager-network-smoke.py` | Wrapper de execução de comandos de ensaio |
| `platform-manager-keycloak-ci.mjs` | `tests/platform` | Testes de realm e tokens assinados de Keycloak efêmero |
| `bash tests/platform/core-host-runtime-smoke.sh` | `tests/platform` | Recusa execução sem `GITHUB_ACTIONS=true` e `CI_RUNTIME_SMOKE=1` |
| `tests/platform/ci-secret-fixtures.py` | `tests/platform` | Grava arquivos sintéticos sob `/run/syndes/runtime`; **não é comando seguro de auditoria local** |

As assinaturas descritas vêm da leitura das fontes, não de um pacote Q01 exportável. Evitar copiar código de infra/módulos e apresentá-lo como biblioteca pública.

## APIs, contratos, eventos e dados

**Q01 não publica endpoints HTTP, contratos OpenAPI, eventos do Event Bus, classes de domínio, exports de package ou schemas/migrations próprios**. O contrato com o CI é **executar testes e emitir exit code/resultado**, correlacionados ao SHA, job, ambiente e negativa verificada. APIs e objetos SQL testados pertencem a suas unidades de runtime.

- **Banco PostgreSQL:** `tests/platform/postgres-smoke.sh` valida múltiplos DBs/roles em fixture. `modules/service-management/test/service-funnels-pg17.test.mjs` possui seu próprio banco de ensaio sob o owner P05.
- **Autorização/identidade:** OpenFGA/Keycloak de CI testam políticas e JWT, sem se conectar ao tenant/realm operacional.
- **Segredos:** OpenBao e `ci-secret-fixtures.py` usam fixture; valores não devem constar no Docs nem serem reutilizados em ambientes reais.
- **Frontend:** Q01 não tem frontend, tela, rota ou API. Browser E2E é executado nas suites dos aplicativos Workspace, Support e Manager, sob seus respectivos owners.

## Estado dos testes, suites e lacunas

- [Estratégia de testes](../../engineering/TEST-STRATEGY.md) define unit/integration/security/RC e stress/spike/soak. Planejar 2500 tenants **não** prova suportar 2500 tenants.
- `tests/security`, `tests/integration` e `tests/performance` possuem neste checkout seus `AGENTS.md`, mas nenhum executor próprio nessas subpastas; cenários podem estar em outros locais e exigem matriz por requisito.
- [Run 43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846), SHA `bd0aa69`: 24/24 jobs success (incluindo infra e paridades). Esta aprovação é vinculada à revisão e ao ambiente.
- **Não verificado nesta auditoria:** benchmark com recursos controlados, restore de produção, operações em staging/produção, aceite comercial, consentimento do proprietário para release.

[Escopo Q01](ESCOPO.md) · [STATUS](STATUS.md) · [Evolução/WBS](EVOLUCAO.md).
