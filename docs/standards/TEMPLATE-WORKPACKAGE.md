# Modelo de workpackage — Syndes

> Template de criação. Um pacote só existe como **planejamento aprovado** após decisão registrada. Não confundir referência na WBS com tarefa atribuída.

## WP — [ID do módulo]-WP-[NN] · [Objetivo observável]
- **Módulo proprietário:** [ID, nome, path próprio].
- **Motivação / requisitos aprovados:** [IDs e Markdown exatos].
- **Origem:** [Issue, WBS, decisão].
- **Prioridade e gate:** [P0–P3, evidência de decisão].
- **Responsável:** [agente/unidade ou não atribuído].
- **Estado:** PROPOSTO / PLANEJADO / APROVADO / EM EXECUÇÃO / BLOQUEADO / CONCLUÍDO / ACEITO.
- **Dependências:** [contratos públicos e workpackages com IDs].
- **Contrato de saída:** [resultado verificável, teste, evidência].

## Tasks do workpackage

| Task ID | Entrega específica | Arquivos autorizados | Depende | Critério de aceite / testes | Estado | Evidência |
|---|---|---|---|---|---|---|
| [ID]-TASK-[NNN] | [comportamento] | [path] | [IDs] | [asserts e gate] | PROPOSTA | — |

## Checkpoint de conclusão
- [ ] Requisitos e interfaces públicas revisados; nenhum módulo externo modificado.
- [ ] Testes unitários, integração, segurança e browser afetados executados.
- [ ] CI e commit SHA registrados, ambiente indicado.
- [ ] Gate de aceite cumprido com evidência; sem tratar merge como deploy.
- [ ] `EVOLUCAO.md`, `SPRINT.md` e `STATUS.md` conciliados.

## Handoff
- **Prompt de projeção:** `docs/subprojects/[ID]-[slug]/PROJECAO.md`, para dúvida de escopo.
- **Prompt de implementação:** `docs/subprojects/[ID]-[slug]/IMPLEMENTACAO.md`, somente com pacote aprovado.
- **Prompt de alteração:** `docs/subprojects/[ID]-[slug]/ALTERACAO.md`, somente ajuste pontual.

O módulo executa seu pacote até o checkpoint e para. Dependências externas são encaminhadas às respectivas unidades.
