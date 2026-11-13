---
title: "Q07 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

> L12: \| **Integração de módulo Serviço** \| **PASS local em PG17 descartável:** 19/19 testes, incluindo Nest HTTP, tenant A/B, equipes e trilha auditável, `npm pack --dry-run` \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L32: **Q07 não publica API HTTP, eventos do domínio nem banco operacional.** Seu contrato público para GitHub Actions é a matriz JSON `{"include":[{"suite":"...", "node":"..."}]}`, os exit codes, logs de jobs e o `Syndes CI Gate`. Não modificar contratos públicos de P01/P02/P03/P05 para corrigir seleção.

> L42: Q07 **não possui frontend, schema SQL ou migration próprios**. GitHub Actions e Syndes Docs são as interfaces de acompanhamento; o PG17 da suite Serviço é temporário e não substitui tenant real. Não publicar dados sensíveis, tokens, endpoints administrativos nem senhas de ambientes operacionais.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Q07 não mantém API HTTP, schema PostgreSQL, controller, port NestJS nem eventos de negócio**. Seus contratos executáveis são **comandos, JSON de planejamento, YAML de CI e exit codes**, consumidos pelo GitHub Actions.

> L35: **Fronteira de código:** Q07 pode alterar scripts/workflows de CI e seus testes. As assinaturas `ServiceFunnelService`, `InboxService`, Core, schema `service` e endpoints continuam pertencendo aos módulos. A seleção de teste **não habilita** um módulo operacional.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
