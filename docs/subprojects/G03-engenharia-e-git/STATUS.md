# G03 — Engenharia e Git | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 12/11/2026.** Fontes `AGENTS.md`, scripts de escopo/CI/docs, WBS e padrões examinados em `origin/main` SHA `068954a21e3090c7f94d374e2a8486cec7c2537b` (DevServer01, worktree isolada). É auditoria **de código estático e governança**, não homologação de CI/Projects, isolamento técnico dos agentes ou deploy.

## Estado multidimensional

| Dimensão | Situação comprovada | Limite |
|---|---|---|
| **Documentação G03** | **Auditoria parcial** | Capítulos de processo e fontes reconciliados; revisão/aprovação da política pendente |
| **Runtime G03** | **Não aplicável** | Owner é `AGENTS.md`; não possui package, endpoint, schema, worker ou front de produto |
| **Implementação de ferramentas** | **Scripts e workflow encontrados** | `verify_module_scope.py`, `plan.mjs`, `syndes-ci.yml`, `sync_github_project.py`, `build_site.py`; presença ≠ funcionamento aceito |
| **Qualidade/CI central** | **Falha conhecida, gate não satisfeito** | Run [43332115355](https://github.com/delmacy/syndes-system/actions/runs/43332115355) falhou em `Prove fail-closed test selection and removed-workflow parity`; revalidar após correção por Q07 |
| **Segregação por agentes** | **Regra documentada; checker consultivo** | `verify_module_scope.py` declara `advisory enforcement`; não afirmar sandbox ou permissão filesystem |
| **GitHub Projects** | **Integração preparada, sincronização não verificada** | Variável/token e itens reais no Project não validados nesta auditoria; não inventar cards/status |
| **Operação e aceite** | **Não aplicável à G03 como serviço; revisão não aprovada** | Deploy e aceites pertencem aos owners, CI e responsável do produto |

## Evidências por fonte

| Arquivo/referência | Achado no checkout | Não permite concluir |
|---|---|---|
| `AGENTS.md` | Regras de MVP, autorização, testes, isolamento, gates e instruções locais | Que agentes cumpram tudo automaticamente |
| `modules/*/AGENTS.md`, `apps/workspace-web/AGENTS.md`, `tests/**/AGENTS.md` | Regras próximas ao owner, complementares às globais | Que cada app/package tenha `AGENTS.md` próprio |
| `scripts/docs/verify_module_scope.py` | Compara arquivos modificados ao owner e `documentationParent`, inclui untracked | Que escrita cross-owner esteja fisicamente bloqueada |
| `.github/workflows/syndes-ci.yml`, `scripts/ci/plan.mjs` | Gates e planner de regressão impact/full no mesmo pipeline | Que todas as suites/branch atual passaram |
| `scripts/docs/sync_github_project.py`, workflow de sync | Importação idempotente de Issues etiquetadas, condicionada a permissão | Project populado ou status/assignee sincronizado |
| `docs/standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md` | Vínculos requisito/WBS/Issue/commit/teste/deploy/aceite | Estado atual de Issue/Project sem consulta ao serviço |

## Bloqueios e divergências

1. **Mainline CI vermelho:** falha em paridade dos workflows, com regressões posteriores/skipped no run citado. Owner Q07; corrigir/testar em frente separada sem enfraquecer gate.
2. **Checker não é sandbox:** não afirmar que agentes “só podem” mudar seu diretório; proteção efetiva requer controles externos, escopo e revisão.
3. **GitHub Projects:** backfill/campos de status não comprovados; falta evidência dos itens e permissão do Project.
4. **Rastreabilidade:** WBS histórica/Issue/Project e documentação não devem ter progressos manuais independentes.
5. **`main` e branches:** não introduzir branch protection nem limpar worktrees sem escopo/decisão do proprietário.
6. **Cobertura de CI:** impacto por path e catálogo de suites precisam ser mantidos em sincronia com novos módulos; risco de lacuna de suíte é tema de Q07.
7. **Segurança de documentação pública:** não publicar credenciais, tokens, PII, endereços de administração ou configurações sensíveis.

## Entregas desta revisão

- [ESCOPO](ESCOPO.md): missão, exclusões, regras dos agentes, matriz de contratos, critérios de testes e diagrama de mudanças.
- [Referência](REFERENCIA-TECNICA.md): scripts, funções e limites verificáveis, sem inventar API ou banco.
- [Plano de 57 unidades](../../blueprint/PLANO-ATUALIZACAO-MODULOS.md): G03 passa de baseline para **auditoria parcial**; demais STATUS operacionais não foram promovidos.
- **Sem alterações em `AGENTS.md` original, módulos, workflows, código de runtime, GitHub Projects ou infraestrutura.**

## Próximo checkpoint

1. **Responsável de Engenharia:** validar o processo e distinguir regras aprovadas de propostas de endurecimento de permissões.
2. **Q10 — Quality Gates:** próxima auditoria documental; critérios de aceite e evidências para releases.
3. **Q07 — CI central:** corrigir a falha de paridade com testes adequados no escopo responsável e confirmar run verde por SHA.
4. **Integração Projects:** somente marcar sincronizado após verificar variável/token, itens e estados reais na plataforma.

| Data | SHA/ambiente da auditoria | Método | Não verificado |
|---|---|---|---|
| 2026-11-12 | `068954a21e3090c7f94d374e2a8486cec7c2537b` · DevServer01/worktree isolada | Leitura de AGENTS, scripts, workflows, WBS e padrões versionados | Run verde de CI, isolamento físico, Projects, release, homologação |

**Estado final desta etapa:** documentação parcialmente reconciliada; aceite de governança pendente. Não interpretar publicação no Pages como gate global aprovado.
