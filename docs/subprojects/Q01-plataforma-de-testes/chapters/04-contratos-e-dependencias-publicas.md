## 4. Contratos de execução, entradas e dependências

**Q01 não expõe endpoints HTTP, package exports, eventos de negócio, controllers, migrations nem classes de domínio.** Seus contratos observáveis são arquivos de teste, comandos, exit codes, fixtures e resultados dos jobs executados por Q07.

| Contrato / interface | Entrada | Efeito observável | Restrição |
|---|---|---|---|
| `bash tests/integrity/repository-structure.sh` | Checkout versionado com AGENTS e catálogo | Check estrutural com exit code | Q10 é responsável pelo próprio script |
| `bash scripts/ci/run-suite.sh <suite>` | Identificador presente no catálogo Q07 | `npm ci` e suites, Go ou infraestrutura | Inexistente/erro deve falhar, não virar PASS |
| `scripts/ci/plan.mjs` | Paths ou modo full; markers/lockfiles | Matriz JSON de `{suite,node}` | Q07 decide seleção e gating por SHA |
| `tests/platform/postgres-smoke.sh` | Compose PostgreSQL descartável | DB/roles, tenant registry, dump/restore de fixture | Testes só em ambiente CI; nenhuma mudança operacional |
| `tests/platform/openfga-smoke.sh` | OpenFGA e modelo de teste | Check allow/deny, isolamento A/B | Store/test token descartáveis; FGA real da plataforma pertence a C04 |
| `tests/platform/openbao-smoke.sh` | OpenBao CI + certificado de fixture | Health/TLS, init/unseal e API de secretos | **Unseal 1-of-1 é exclusivo de CI**, não exemplo de configuração produtiva |
| `tests/platform/platform-manager-keycloak-ci.mjs` | Keycloak/realm de ensaio | JWT assinado, audience e requests negativos | Direct Access Grants apenas para clients descartáveis |
| `tests/platform/core-host-runtime-smoke.sh` | Containers e `GITHUB_ACTIONS/CI_RUNTIME_SMOKE` | Ready/segurança do Host de CI | Recusa execução fora de contexto de CI |
| `tests/platform/ci-secret-fixtures.py` | Arquivo `infra/.env.ci` sintético | Arquivos de segredos descartáveis | Executar apenas no runner isolado; escreve em `/run/syndes/runtime` |
| `tests/performance/AGENTS.md` | Política de carga | Metodologia proposta | **Não constitui comando de benchmark implementado** |

### Dependências por owner

| Camada | Implementador/owner | O que a Q01 registra |
|---|---|---|
| Estrutura de repositório | **Q10** (`tests/integrity`) | Resultado de conformidade e limites |
| Matriz e execução GitHub Actions | **Q07** (`scripts/ci`, workflows) | SHA, jobs obrigatórios e artefatos |
| Scripts de plataforma | **Q01** (`tests/platform`, AGENTS do diretório raiz) | Cenários de DB, segurança, identidade e rede |
| Provas de produto | **Módulos** (`modules/*/test`, `apps/*/test`) | Links para suite, não alterar seus contratos |
| Autorização/identidade/segredos | **C03/C04/C05/Infra** | Ambiente real separado do descartável |
| RC/rollback e backup operacional | **Q08/Q09/I10/I11/Operação** | Requer evidência de restore, digest e sign-off |
| Aceite comercial/UX | **G02 e Product Gate de cada módulo** | CI é requisito, não decisão de produto |

### Contrato de evidência mínima

`testId + owner + commit SHA + comando/run + ambiente + fixture + resultado PASS/FAIL/SKIP/BLOCKED + negativos + limitações`. Se o teste depende de Keycloak/OpenFGA/PG reais, registrar se os containers eram descartáveis, assim como imagem e versão. **Não publicar a URI completa com credencial, bearer ou secret nos registros públicos.**

Mudanças entre owners — inclusive para ampliar a cobertura — exigem revisão própria. Um resultado de teste não concede permissão de escrita em outro módulo.
