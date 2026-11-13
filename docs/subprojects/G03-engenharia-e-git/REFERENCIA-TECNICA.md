# G03 — Engenharia e Git | Referência técnica

> **AUDITORIA DOCUMENTAL ESTÁTICA PARCIAL — 12/11/2026.** Fonte examinada no commit `068954a21e3090c7f94d374e2a8486cec7c2537b`. G03 é governança de engenharia, com owner `AGENTS.md`; **não** possui runtime NestJS, endpoint, schema ou API própria.

## Stack e ownership

- **Artefato principal:** `AGENTS.md` na raiz e regras locais em `modules/*/AGENTS.md`, `apps/workspace-web/AGENTS.md` e `tests/**/AGENTS.md`.
- **Metadados:** `catalog/work-units.json` (owner e source), `catalog/evolution-associations.json` (WBS) e `catalog/traceability-links.json` (vínculos, não status).
- **Git/CI:** `.github/workflows/syndes-ci.yml`, `scripts/ci/plan.mjs`, `plan.test.mjs`, `parity.test.mjs`, `run-suite.sh` e suites locais dos owners.
- **Portal:** `scripts/docs/build_site.py` com conteúdo Markdown versionado, páginas geradas e `.github/workflows/syndes-docs-pages.yml`.
- **Projects:** `scripts/docs/sync_github_project.py` e `.github/workflows/syndes-docs-project-sync.yml`, sujeitos a autorização e configuração.

## Classes, métodos e mecanismos encontrados

**Não existem classes/métodos de aplicação pertencentes a G03.** Os scripts de apoio são responsabilidade de engenharia e usam arquivos versionados:

| Fonte | Rotina/função identificável | Efeito ou limite |
|---|---|---|
| `scripts/docs/verify_module_scope.py` | `verify_changed_paths`, `allowed_roots`, `get_changes` | Compara arquivos modificados com o owner; **consultivo, não controle de acesso** |
| `scripts/ci/plan.mjs` | `selectSuites`, `installedSuites` | Seleciona catálogo de regressões; mudanças desconhecidas acionam full |
| `scripts/ci/run-suite.sh` | Executor de suites por ID | Executa testes selecionados; sua existência não prova resultado |
| `scripts/docs/sync_github_project.py` | `parse_project`, `collect_pages`, `sync` | Importa Issues etiquetadas ao Project quando autenticado; não sincroniza automaticamente campos de status |
| `scripts/docs/build_site.py` | `site_navigation`, `main` | Gera navegação/documentação e índice por owner a partir das fontes |

As assinaturas completas são as do **código na revisão específica**, não desta síntese.

## APIs, contratos públicos e eventos

**G03 não expõe APIs HTTP, schema GraphQL nem eventos do Event Bus do Syndes.** GitHub REST/Projects são integrações externas do sincronizador, não interfaces públicas do produto.

- Para **imports entre módulos**, conferir `package.json#exports`, versão e owner; `docs/standards/CONTRATOS-PUBLICOS.md` é índice, não source of truth executável.
- **Interface de proposta de alteração:** `docs/assets/topic-editor.js` cria solicitações contextualizadas; Pages não efetua gravação no Git.
- **Política de escopo do agente:** `AGENTS.md` e `verify_module_scope.py` orientam e detectam alterações, mas **não impedem acesso a caminhos fora do owner**.
- **GitHub Project:** para manipular Projects, `SYNDES_PROJECT_URL` e `SYNDES_PROJECTS_PAT` precisam existir e ter permissão; não publicar valores nem presumir sincronização.

## Frontend

**Não existe frontend G03 operacional.** O site Syndes Docs é interface de leitura da documentação. Os botões de propor atualização enviam rascunho para revisão ou edição via GitHub conforme permissões, não são endpoints de modificação. O Workspace e o Manager são interfaces do produto com owners distintos.

## Schemas e migrations

**Nenhuma tabela ou migration pertence à G03.** Git é a origem de código/histórico; Issues/Projects armazenam estados externos sob controle do GitHub; WBS e documentação guardam vínculos e decisões. O `Control DB` e os bancos de tenant não são utilizados para planejar workpackages do portal.

## Qualidade e pendências

- **CI mainline:** [workflow](https://github.com/delmacy/syndes-system/blob/main/.github/workflows/syndes-ci.yml); um run com falha de paridade não é gate aprovado. Observar runs e SHA, sem editar pipeline nesta revisão.
- **Testes da documentação:** `python -m unittest discover -s scripts/docs`, `node --test scripts/docs/test_*.mjs` e `mkdocs build --strict`, executados pelo fluxo local; resultado do próximo commit precisa ser verificado separadamente.
- **G03 STATUS:** [auditoria, riscos e próximos gates](STATUS.md).
- **G03 Escopo:** [regras, matrizes e diagrama](ESCOPO.md).
- **G03 WBS:** [WP-00, vinculações históricas](EVOLUCAO.md).

**Lacunas:** segurança impeditiva real para agentes, confirmação de sincronização Projects, CI central verde e aceite formal da governança.
