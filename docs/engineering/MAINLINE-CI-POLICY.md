# Syndes — Mainline CI e política de integração

## Objetivo

A branch main é a **única linha de integração contínua**. Uma feature não está integrada por estar verde na própria branch. O objetivo é reduzir a diferença entre o produto em desenvolvimento e main sem publicar mudanças ainda não homologadas em produção.

Main estável não equivale a produção automaticamente. Releases são promovidos a partir de um SHA aprovado da main, com artefatos imutáveis, smoke em staging, aprovação de produção e procedimento de rollback.

## Contrato de CI

- Todo PR novo deve sair da main atual e ter main como base. Não criar novas cadeias permanentes de PRs entre branches.
- O workflow .github/workflows/syndes-ci.yml não tem filtros de paths: o job final Syndes CI Gate aparece em todo PR para main, independentemente dos arquivos modificados.
- O checkout padrão do evento pull_request executa testes no merge sintético (resultado combinado com o destino). O diff de base/head serve apenas para selecionar as suites afetadas.
- Segurança e dependências críticas propagam impacto para todos os componentes instalados. Componentes desconhecidos nunca dispensam os testes existentes.
- Suites selecionadas são paralelas; no push para main, merge_group e disparo manual, todas as suites instaladas são selecionadas.
- Alterações somente em documentação ainda verificam governança e o teste do planejador.
- Falhas, cancelamentos e jobs ignorados dentro do conjunto obrigatório bloqueiam o gate final.
- Suites não podem ser removidas ou ter assertions relaxadas apenas para obter CI verde.
- Testes cross-tenant, autorização, migrations, contratos e E2E críticos são bloqueadores antes da liberação; desempenho pesado pertence ao gate de release, em ambiente isolado.

## Proteção requerida da main (configuração administrativa no GitHub)

1. Desabilitar push direto / exigir PR, revisão e resolução de conversas.
2. Exigir Syndes CI Gate como status check obrigatório e impedir merges com branch desatualizada; preferir merge queue quando habilitada.
3. Impedir bypass do gate por contas de serviço não autorizadas.
4. Para deployment, exigir build por SHA da main, smoke em staging e aprovação de produção. Evitar usar tags móveis como origem do deploy.

**A presença do YAML, sozinha, NÃO configura branch protection nem protege um repositório contra push direto.**

## Migração segura da cadeia legada

Estado inicial identificado em 2026-11-09: PRs empilhados a partir do Kernel, Core Host, CRM, Inbox, Workspace, WhatsApp e PR #27 de integração; PRs #33 (Platform Manager) e #34 (Support) dependem da base do PR #27.

1. Aprovar esta fundação de CI e torná-la o gate principal da main.
2. Registrar dependências e critérios de aceite dos PRs pendentes; não eliminar branches até preservação de código e histórico ser verificada.
3. Trazer a fundação Kernel (PR #4) em PR verificável à main; depois Core Host (#5), CRM (#6) e dependentes em ordem topológica, atualizando base após cada merge. PRs legados draft precisam ser revisados e colocados como ready-for-review explicitamente.
4. Após o bloco funcional mínimo, validar a integração Workspace/Organizations/CRM (#27) em candidato que parta da main; **não** incorporar código por merge de uma branch gigantesca sem auditar diff, migrations e regressões.
5. Trazer Platform Manager (#33) e Syndes Support (#34) como PRs independentes contra a main já integrada, sem confiar apenas em testes da branch de integração.
6. Migrar cada gate de workflow legado (Core Kernel, Host/Infra, CRM, Inbox, WhatsApp TS e Go, Workspace, Support, E2E, Platform Manager) preservando evidência de equivalência: testes, runner/env, PostgreSQL, Keycloak, OpenFGA, Playwright, artifacts e condições de disparo. Excluir workflow antigo **somente após equivalência comprovada**.
7. Só então encerrar PRs/branches redundantes, comprovadamente absorvidos e com nenhuma alteração exclusiva relevante.

## Critérios para considerar a migração concluída

- main contém todo código funcional **aprovado**, e nenhum módulo depende de uma base de PR de longa duração;
- o status Syndes CI Gate é obrigatório e funciona para PRs com e sem alterações de código;
- testes de segurança e isolamento são comprovados no estado integrado;
- suites legadas não ficam silenciosamente sem sucessor;
- deploy consome artefatos rastreáveis à main, com staging, release e rollback;
- branches/PRs antigos são tratados por rastreabilidade, não eliminados indiscriminadamente.

## Limite da fase inicial

O primeiro PR entrega o orquestrador, executor, planner, regressões de seleção e documentação. **Não** declara paridade com os 12 workflows presentes nas branches de produto nem autoriza removê-los. O cutover de todos os testes e a promoção funcional dos PRs antigos são trabalho subsequente, bloqueado pelos resultados de CI.
