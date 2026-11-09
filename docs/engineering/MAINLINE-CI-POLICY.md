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

## Política vigente da main — desenvolvimento (decisão do proprietário, 09/11/2026)

A `main` é a linha única de integração do produto e **fica sem branch protection administrativa nesta fase**. O proprietário autorizou commits/merges diretos na `main`; revisão obrigatória e bloqueio administrativo de merge ficam adiados até uma etapa posterior, definida pelo proprietário.

- Manter `Syndes Mainline CI` executando em PRs e em todo push para `main`, com o job agregador `Syndes CI Gate` verificando suites impactadas ou completas.
- CI verde é condição de qualidade de engenharia. Sem branch protection, falhas de CI são alertas e não bloqueio automático de merge pelo GitHub; não tratá-las como comprovação de release.
- Preferir PRs de vida curta derivados da `main` e merges após validação quando possível. Push direto está permitido nesta fase.
- Não ativar multi-organização, migrar dados operacionais ou fazer deploy automaticamente por causa de um merge. Implantação em produção ainda exige gates específicos, artefatos por digest, staging, backup e rollback.
- **Fase futura, não vigente:** quando o proprietário solicitar, reconsiderar required checks, aprovação de review, proibição de force push, merge queue e restrições administrativas. Não aplicar essas proteções antecipadamente por iniciativa de ferramentas ou agentes.

Verificação em 09/11/2026: GitHub `main.protected=false`, sem rulesets ativos. A presença do YAML não constitui branch protection.

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
- o Syndes CI Gate funciona em PRs e no push para main e é monitorado pela engenharia, sem required-check administrativo nesta fase;
- testes de segurança e isolamento são comprovados no estado integrado;
- suites legadas não ficam silenciosamente sem sucessor;
- deploy consome artefatos rastreáveis à main, com staging, release e rollback;
- branches/PRs antigos são tratados por rastreabilidade, não eliminados indiscriminadamente.

## Limite da fase inicial

O primeiro PR entrega o orquestrador, executor, planner, regressões de seleção e documentação. **Não** declara paridade com os 12 workflows presentes nas branches de produto nem autoriza removê-los. O cutover de todos os testes e a promoção funcional dos PRs antigos são trabalho subsequente, bloqueado pelos resultados de CI.

## Migração de paridade: Support + Platform Manager (PR #47, 2026-11-09)
A integração da base funcional com Support e Platform Manager preserva **um único** orquestrador: `.github/workflows/syndes-ci.yml`. Foram acrescentadas suites de **paridade descartável real** para Support Browser (Chromium + Keycloak OIDC + OpenFGA + PostgreSQL) e Platform Manager (Keycloak real, PostgreSQL de Control Plane, redes e UI), chamando os próprios workflows antigos via `workflow_call`. Os jobs pesados só são selecionados quando o planejador de impacto inclui os respectivos componentes, ou no modo full. O job final valida o resultado `success` para testes selecionados e admite `skipped` **exclusivamente** para uma suite que o planejador não selecionou; nunca admite skip de teste obrigatório. A suite `support` agora ensaia **pg_dump/pg_restore/rollback sintético** no mesmo PostgreSQL descartável.

A baseline `main` recente já possuía Kernel/Host/CRM/Inbox e o pipeline, mas recebeu codepaths similares por commits diferentes. O candidato reconcilia os arquivos compartilhados com o código de funcionalidades mais recente mantendo o CI de `main`; esse ajuste exige review humano por arquivo e todos os checks no commit integrado. Até paridade integral e revisão, **não remover os workflows antigos** de desenvolvimento, não dar merge automático e não fazer deploy.

## Gate central único — evidência de paridade da PR #47 (09/11/2026)

A candidata `integration/platform-support-preflight-20261109` consolidou os antigos workflows por módulo em **um acionador de PR/push/merge queue** (`.github/workflows/syndes-ci.yml`) e **dois reusable workflows sem gatilhos próprios** (`support-browser-e2e.yml`, `platform-manager.yml`). As suites continuam separadas internamente por matriz/impacto, mas toda decisão de promoção tem um único resultado `Syndes CI Gate`, exigido na proteção administrativa real do `main`.

Como prevenção contra regressão silenciosa após excluir YAMLs redundantes, `scripts/ci/parity.test.mjs` fixa em testes automatizados os controles essenciais retirados dos workflows legados: rotas e dependências do planner, Go `vet/test -race/build/gofmt`, Core Host build, PostgreSQL real/restore, migration tenant-only, Keycloak, OpenFGA, OpenBao, redes privadas, scripts de owner/segredos Manager e E2E Playwright real. A suíte principal agora executa `node --test scripts/ci/*.test.mjs` e falha se alguma dessas verificações for removida sem migração explícita do contrato. Este **teste estático** confirma presença e encadeamento; ele **não substitui** os testes de execução reais do gate.

O candidato com os três workflows apresentou `22/22` jobs com sucesso em [GitHub Actions #42681526208](https://github.com/delmacy/syndes-system/actions/runs/42681526208). Histórico: em 09/11/2026 houve proteção de main e exigência de review, posteriormente **revogadas por decisão expressa do proprietário**. O PR #47 foi promovido após 22/22 jobs aprovados no SHA 66081f3; requisitos operacionais permanecem separados para deploy.

## Integração aprovada de código — PR #47 (09/11/2026)

Com autorização explícita do proprietário para trabalhar na main sem branch protection, o PR #47 foi integrado pelo merge `4bba2ec1dfa97407fd1f33e9679a5dce35c55d3c` após `Syndes CI Gate` 22/22 verde no SHA candidato `66081f398248d1c55e9724f74ff84098ab7d8f4c` (run #42682866186). O merge não representa deploy de produção nem liberação do Product Gate #31 ou dos Release Gates Support e Platform Manager. A CI de push da main deverá ser monitorada separadamente.
