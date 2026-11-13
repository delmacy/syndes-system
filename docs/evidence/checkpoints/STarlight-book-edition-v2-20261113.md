# Syndes — Edição experimental Starlight B · incremento 2

Data da validação: 2026-11-13. Escopo: **somente protótipo documental** em `docs/assets/experimentos/livros/b/` e respectivos scripts/fontes. O portal MkDocs canônico e o produto não foram substituídos.

## Rastreabilidade e capacidade editorial

- 57 unidades canônicas de `docs/subprojects/index.json`, distribuídas em 5 volumes; cada unidade possui ficha padronizada.
- 448 matérias versionadas de `docs/subprojects/<unidade>/chapters/` incorporadas como páginas Starlight independentes, sem transformar assuntos em âncoras da mesma página.
- Ficha por módulo: owner catalogado, código, status, referência técnica (contratos, APIs, classes, dados), operação, oito assuntos, histórico, evolução e links para fontes GitHub.
- Módulos parcialmente auditados não são declarados homologados pela simples presença de capítulos ou código.
- Fontes canônicas preservadas; a edição é uma projeção de leitura, não a fonte de verdade.

## Gates realizados

- `python3 -m unittest discover -s scripts/docs -p 'test_*.py' -q`: 125 testes aprovados (inclui 4 novos testes da edição de livros).
- `node --test scripts/docs/test_editor.mjs scripts/docs/test_layered_portal.mjs scripts/docs/test_projects_dashboard.mjs scripts/docs/test_module_navigation.mjs`: 11 testes aprovados.
- Auditoria de consistência: 20 parciais / 57 unidades, 37 baseline, 0 divergências do validador. AST/lexical: 0 problemas registrados.
- `npm run build` Starlight: 512 páginas HTML renderizadas (57 fichas + 448 matérias + 5 sumários + home + 404).
- `mkdocs build --strict --clean`: aprovado em worktree isolada com as prévias A/B incorporadas ao artefato site.
- Verificação de links estáticos: volume, capítulo A06 e matéria de contratos têm arquivos HTML distintos e fontes GitHub rastreáveis.

## Histórico de publicação e limites

- O commit `25f7bd2` foi enviado ao `main` em fast-forward. Primeira execução de Pages `43448070486` falhou no passo `actions/deploy-pages`, apesar de build/upload concluídos: API retornou zero artefatos imediatamente após upload.
- Segunda tentativa do mesmo run falhou com **dois** artefatos de mesmo nome `github-pages`. O problema é da entrega do artefato; não provar site atualizado apenas com HTTP 200 na versão antiga.
- Uma nova revisão documental inicia run independente; **somente sucesso do run + inspeção dos links públicos** autoriza declarar edição 2 publicada.
- Nenhuma conclusão operacional (PostgreSQL, TLS, IAM, deploy de serviços etc.) decorre desta prova editorial.
