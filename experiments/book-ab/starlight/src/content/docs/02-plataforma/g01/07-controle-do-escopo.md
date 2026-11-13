---
title: "G01 · Controle de escopo"
description: "Volume Plataforma e core · capítulo G01 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle do escopo

**Baseline de requisitos da G01: NÃO APROVADA para novo escopo.** A presente atualização é uma **reconciliação documental de decisões e código existentes**, não nova ADR, Product Gate ou autorização para alterar módulos.

### Classificação das fontes

- **Decisão arquitetural existente:** ADR com estado e data próprios; transcrever o sentido e anotar a versão da fonte, sem promover automaticamente a produção.
- **Código observado:** caminho + revisão Git + verificação de símbolo/config; não inferir execução, compatibilidade ou acesso.
- **Plano ou proposta:** `WBS`, candidato de schema, composição futura e outras interfaces a aprovar; apresentar como pendência, não contrato entregue.
- **Evidência operacional:** testes reais, CI, ambiente, SHA/digest e homologação somente quando comprovados.

### Propostas sujeitas a revisão do owner

| Divergência/risco | Tratativa proposta | Unidade que precisa validar |
|---|---|---|
| `apps/core-api` histórico vs `apps/core-host` atual | Anotar obsolescência sem reescrever decisão original | A04 / G01 |
| `@syndes/inbox` em índice de contratos vs `@syndes/core-inbox` no manifesto | Corrigir a entrada do índice normativo com fonte de package, conferir consumidores | P02 / G01 |
| Esquemas de módulo ainda propostos vs SQL histórico em `public` | Registrar matriz de migrações e gates; não executar DDL neste trabalho | I04 / C02 / módulos |
| Controle ENABLED e Event Worker não comprovados no ambiente-alvo | Validar testes negativos, ledger, grants e restore em gates próprios | A04 / C01 / C06 / Q04–Q05 |
| Perfis de composição por instância não materializados | Continuar CMP-01/CMP-02 em escopo aprovado antes de implementar perfis | P14 / A08 / A04 |

### Política de mudança

A G01 pode editar **somente sua própria documentação e os registros de decisão formalmente atribuídos a ela**, de acordo com o escopo aprovado. Mudanças em `packages/core-kernel`, `apps/core-host`, `modules/*`, migrations ou configuração operacional são de responsabilidade dos respectivos owners e exigem aprovação/execução separada. Não transformar uma auditoria documental em implementação transversal.

**Checkpoint:** 12/11/2026 — leitura de fontes e documentação; homologação de arquitetura, integração e operação **não verificada**.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/07-controle-do-escopo.md).
