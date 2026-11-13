---
title: "G03 · Requisitos e casos de uso"
description: "Volume Infraestrutura e qualidade · capítulo G03 · matéria 02"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/02-requisitos-historias-e-casos-de-uso.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 2. Requisitos, histórias e casos de uso de engenharia

Os casos abaixo são **interpretações de processo das regras existentes**, não novas funcionalidades do Syndes nem autorizações para executar ações fora do owner.

### Requisitos rastreáveis

| ID documental | Regra existente | Evidência necessária para cumprir |
|---|---|---|
| G03-R01 | Ler AGENTS raiz e local antes de editar | Paths do owner + instruções consideradas |
| G03-R02 | Alterações devem respeitar o dono canônico do pacote | Diff por módulo e verificação de consumidores; incidente de cross-owner é bloqueado para revisão |
| G03-R03 | Trabalho paralelo sem sobrescrever worktree alheia | `git status` antes/depois, branch e SHA base explícitos |
| G03-R04 | Gate de teste não pode ser enfraquecido para ficar verde | Runs, falhas/skips por SHA, suites relevantes e logs |
| G03-R05 | CI da mainline escolhe suites por impacto e faz full em push | `scripts/ci/plan.mjs`, `syndes-ci.yml` e execução verificada |
| G03-R06 | Produto e arquitetura usam fontes normativas por owner | PRD/ADR/contrato/SQL em seu repositório, links nos consumidores |
| G03-R07 | Issues e Projects não criam aceite por associação | Item explícito, Issue, WP, PR, commit, teste, deploy, aceite separados |
| G03-R08 | Página estática não altera conteúdo autonomamente | Proposta contextual revisada, Issue/PR e commit após autorização |
| G03-R09 | Dados e credenciais não saem para Pages/Issues públicos | Revisão de secrets, URLs internas, PII e metadados sensíveis |

### Histórias e fluxos de consulta (não novos Product Gates)

**US-G03-01 — Alteração isolada:** como agente, quero localizar o owner e ler suas regras para produzir um diff limitado sem afetar módulos não autorizados. Entrada: módulo/capítulo/Issue + SHA; saída: diff, testes e proposta de impacto.

**US-G03-02 — Quebra de contrato:** como engenheiro, quero localizar export/consumer antes de mudar uma API, evento ou migration. Se houver alteração transowner, escalo para decisão/PR independente, sem realizar escrita em projeto alheio por iniciativa própria.

**US-G03-03 — Revisão do release:** como responsável técnico, quero verificar os jobs *realmente executados* e seu resultado para não liberar um commit que falhou ou teve suite requerida ignorada.

**US-G03-04 — Consulta de projeto:** como gestor, quero distinguir WBS, Issue e Project do histórico de código para saber o que está planejado, bloqueado, testado ou homologado.

### Caso UC-G03-01 — Modificar um módulo com segurança

1. Identificar ID/owner no catálogo, revisar `AGENTS.md` global + local, STATUS, contrato público e escopo autorizado.
2. Fixar branch/worktree e SHA base sem resetar nem limpar trabalho alheio.
3. Preparar diff limitado; classificar nova demanda como BLOCKER, BUG, MVP ou POST-MVP; última classe não recebe implementação antes do gate.
4. Conferir `verify_module_scope.py` quando aplicável, **sabendo que é consultivo**, e revisar as mudanças manualmente.
5. Rodar testes adequados ao impacto; para mudança transversal exigir avaliação de consumers e gate CI do SHA.
6. Registrar PR/commit, CI, ambiente, rollback, STATUS e Product Gate quando verificado; não promover estados automaticamente.

**NFR:** toda decisão deve ser reproduzível por outra pessoa a partir de SHA, owner, comandos, ambiente, evidência e links.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/02-requisitos-historias-e-casos-de-uso.md).
