---
title: "G03 · Capacidades"
description: "Volume Infraestrutura e qualidade · capítulo G03 · matéria 03"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/03-capabilities.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 3. Capacidades de engenharia — evidência e limites

| Capacidade governada | Arquivo/artefato encontrado | Limite verificado |
|---|---|---|
| Instruções globais e por módulo | `AGENTS.md`, `modules/*/AGENTS.md`, `apps/workspace-web/AGENTS.md` | Há regras locais em módulos de produto; **não** presumir que todo package/app possui AGENTS próprio |
| Gate de integridade de estrutura | `tests/integrity/repository-structure.sh`, job `foundation` | Checa estrutura e mínimo de AGENTS de módulos, não todos os contratos semânticos |
| Planejador de CI | `scripts/ci/plan.mjs`, `plan.test.mjs`, `parity.test.mjs` | Catálogo de suites por impacto; qualquer falha de teste bloqueia o gate |
| Runner por suite | `scripts/ci/run-suite.sh`, suites JS/Go/infrastrutura | Resultado depende da execução real e ambiente do run |
| GitHub Pages | `.github/workflows/syndes-docs-pages.yml`, `scripts/docs/build_site.py` | Deploy do portal não equivale a CI geral verde |
| Atualização contextual | `docs/assets/topic-editor.js`, `docs/standards/EDICAO-CONTEXTUAL.md` | Gera proposta/Issue ou edição via GitHub; **não** grava Pages em si |
| Limite de owner consultivo | `scripts/docs/verify_module_scope.py` e respectivos testes | Denuncia mudanças fora do root, **não** impede acesso físico nem substitui CI |
| Project sync | `.github/workflows/syndes-docs-project-sync.yml`, `scripts/docs/sync_github_project.py` | Depende de variable/token; **não** é inventário de cards reais/andamento |
| Linha do tempo por commit | `scripts/docs/build_site.py` e catálogo de vínculos | Commit registra alteração; não é prova de deploy, aceite ou linha de tempo de sprint |

### Estados de maturidade independentes

`proposto → aprovado → implementado → testado → integrado → implantado → aceito` são **transições com evidência distinta**; não um único percentual. Uma referência técnica pode estar revisada e ainda não existir operação. Um job CI marcado *skipped* não prova suíte aprovada.

### Capacidade planejada versus presente

- **Planejada:** confiabilidade operacional do pipeline do Syndes e espelhamento completo de projetos. Seu código auxiliar já existe, mas condições de execução e permissões precisam ser verificadas.
- **Implementada parcialmente:** gerador de docs por áreas e abas independentes, inventário de símbolos, prompts/edição contextual e checker consultivo por owner.
- **Não comprovada:** imposição de sandbox ao agente, sincronização de status/campos do Projects, gate CI central verde no SHA observado e entrega final/rollback.

**Regra:** não converter em **capacidade entregue** um script isolado ou um mock de UI que não tenha consumidores, testes, CI e operação comprovados.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/03-capabilities.md).
