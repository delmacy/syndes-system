## 0. Endereços exatos de leitura e evidência

**Revisão:** `origin/main` commit `bd0aa69349879485156ce05ffcb211904d34c206`, 12/11/2026, worktree isolada em DevServer01. Q01 tem o diretório `tests/` como origem canônica no [catálogo das unidades](https://github.com/delmacy/syndes-system/blob/main/catalog/work-units.json). Sua maturidade `distributed` significa **testes distribuídos, não serviço implantado**.

| Categoria | Fonte rastreável | Limite |
|---|---|---|
| Política raiz/local | `AGENTS.md`, `tests/AGENTS.md` | Define invariantes e pirâmide; regra não prova execução |
| Integração | `tests/integration/AGENTS.md` | Diretrizes e prioridade dos módulos; não confundir com suite implementada neste diretório |
| Segurança | `tests/security/AGENTS.md` | Regras de negação/tenant; os scripts executáveis estão distribuídos |
| Performance | `tests/performance/AGENTS.md` | Perfis 50→2500, spike/soak planejados; não são medições |
| Integridade | `tests/integrity/AGENTS.md`, `repository-structure.sh` | Q10 executa testes estruturais simples |
| Plataforma/ambiente | `tests/platform/*.sh`, `*.py`, `*.mjs` | Scripts de PostgreSQL, identidade, redes, Manager e Support |
| Testes por domínio | `modules/*/test`, `apps/*/test`, scripts de cada owner | Existem fora de `tests/`; owners preservados |
| Orquestrador | `.github/workflows/syndes-ci.yml`, `scripts/ci/plan.mjs`, `run-suite.sh` | Q07 planeja/executa; não é ownership exclusivo Q01 |
| Estratégia | [Test Strategy](../../../engineering/TEST-STRATEGY.md) | Commit/PR/RC e critérios de falha |
| Evidência do CI integrado | [Run 43340637846](https://github.com/delmacy/syndes-system/actions/runs/43340637846) | **24/24 jobs success no SHA auditado**, não valida deploy |
| WBS | [Evolução Q01](../EVOLUCAO.md) e [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | 00.08, 95.01 e 95.02 sem promover tarefas |

**É proibido transcrever segredos, dumps reais, dados pessoais, hostnames internos ou tokens dos testes para o site público.** Documentar comandos e nomes de fixtures, não seus valores operacionais.
