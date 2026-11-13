---
title: "G01 · WBS e evolução"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# WBS e evolução

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L9: \| **Documentação** \| **Auditoria parcial** \| Capítulos 00–07 reconciliados com ADRs e fontes de código; aprovação do responsável pendente \|

> L42: - [Evolução/WBS](EVOLUCAO.md): mantém associações existentes sem inventar responsáveis/estados.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L8: - **Natureza:** documentação técnica (Markdown/ADRs/WBS/catálogo). **Sem `package.json`, runtime, build de aplicação ou secrets próprios**.

> L50: - [STATUS](STATUS.md) contém SHA, fontes examinadas, divergências e próximo marco.

> L51: - [WBS](EVOLUCAO.md) mantém tarefas associadas, não mudança de status implícita.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

> L8: - [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/06-wbs-marcos-e-aceite.md)

> L5: A associação de G01 em `catalog/evolution-associations.json` **não transfere ownership nem prova execução**. As referências existentes são: 00.01 (baseline da `main`), 30.01 (matriz de papéis), 55.01 (recorte Basic de atendimento), 60.01 (gate multi-org), 80.01 (funil avançado, congelado) e 90.01 (métricas sanitizadas); ver [Evolução](../EVOLUCAO.md) e [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md

> L21: 3. A WBS e as ADRs ficam ligadas a decisões e evidências; mudanças de arquitetura exigem novo gate, não atualização silenciosa de texto.

### [07-controle-do-escopo.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/07-controle-do-escopo.md)

> L9: - **Plano ou proposta:** `WBS`, candidato de schema, composição futura e outras interfaces a aprovar; apresentar como pendência, não contrato entregue.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
