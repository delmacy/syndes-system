---
name: syndes-delivery
description: Planejar, decompor, acompanhar, revisar e aceitar entregas do repositório Syndes. Use para Product Gates, PRDs, planos, issues, ordens de trabalho, QA, revisão de PRs e decisão de conclusão; não use para trabalho genérico fora deste repositório.
---

# Syndes Delivery

Conduza a entrega sem ampliar o MVP nem antecipar módulos. O repositório é a fonte de verdade; esta skill aplica suas regras e não as substitui.

## Preparação obrigatória

Antes de planejar ou revisar:

1. Leia `AGENTS.md`, `README.md`, `docs/product/MVP-SCOPE.md`, `docs/product/MODULE-ORDER.md` e `docs/engineering/TEST-STRATEGY.md`.
2. Leia o `AGENTS.md` mais próximo de cada área afetada.
3. Confira branch, commit-base, árvore de trabalho, CI, PRs e issues relevantes.
4. Identifique o módulo e o gate correntes. Não avance outro módulo funcional antes do gate exigido pelo repositório.

Se documentos discordarem, pare a mudança afetada, exponha a divergência e peça decisão somente quando ela não puder ser inferida com segurança.

## Classificação e decisão

Classifique todo pedido como `BLOCKER`, `BUG`, `MVP` ou `POST-MVP`.

- Registre `POST-MVP` em uma linha quando útil, mas não pesquise, detalhe, arquitete ou implemente antes do lançamento.
- Capacidades de Platform Core só avançam na profundidade exigida pelo módulo corrente.
- Não crie abstrações, frameworks ou integrações para necessidades hipotéticas.

## Modos de trabalho

### Product Gate e planejamento

Produza requisitos verificáveis, regras de negócio, critérios de aceite, segurança, UX necessária, dependências e dúvidas decisórias. Mantenha requisito, decisão e tarefa distinguíveis. Para decompor trabalho, leia [references/task-order.md](references/task-order.md).

### Execução e acompanhamento

Use GitHub Issues/Projects como registro oficial quando estiverem configurados; não mantenha um backlog concorrente em outro sistema. Uma tarefa deve ter dono, escopo exclusivo, dependências, validação e evidências. Não crie ou altere issues, Projects, branches ou PRs sem que a solicitação autorize essa operação.

Trate falhas técnicas ordinárias dentro da execução. Escale apenas decisão humana não inferível, requisito irreconciliável, credencial/permissão ausente ou dependência externa inacessível.

### QA, revisão e aceite

Para elaborar o plano de testes ou decidir se algo pode ser aceito, leia [references/qa-review-gate.md](references/qa-review-gate.md).

Nunca use commit existente, PR aberto, relato do executor ou CI verde isoladamente como prova de conclusão. Preserve a distinção:

`IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`.

Registre a decisão como `ACEITO`, `CORREÇÕES NECESSÁRIAS` ou `BLOQUEADO`, sempre com evidência e próximo responsável. Somente `ACEITO` autoriza a etapa de integração/finalização já solicitada pelo usuário.

## Coordenação

Trabalhe em um módulo funcional por vez. Paralelismo dentro do módulo só é permitido quando contratos, arquivos e dependências não colidem e a solicitação autoriza delegação. Defina ownership antes de qualquer handoff.

Use skills especializadas quando aplicáveis:

- `define-goal` para objetivos longos explicitamente solicitados;
- `gh-fix-ci` para falhas em GitHub Actions;
- `gh-address-comments` para comentários de revisão;
- `security-threat-model` para threat modeling solicitado;
- `security-best-practices` para revisão de segurança solicitada em stack suportada;
- `playwright` para jornadas web e aceite E2E.

## Saída mínima

Ao planejar ou revisar, informe:

- módulo, gate, classificação e estado;
- escopo incluído e excluído;
- dependências e riscos;
- critérios de aceite e validação;
- evidências obtidas ou ainda necessárias;
- decisão e próximo responsável.
