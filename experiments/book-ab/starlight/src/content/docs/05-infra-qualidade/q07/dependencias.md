---
title: "Q07 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

> L12: \| **Integração de módulo Serviço** \| **PASS local em PG17 descartável:** 19/19 testes, incluindo Nest HTTP, tenant A/B, equipes e trilha auditável, `npm pack --dry-run` \|

> L37: - [Especificação Q07](ESCOPO.md) registra requisitos, histórias, matriz de dependências, diagrama e limites.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L28: Marcador `modules/service-management/package-lock.json`, dependência do `@syndes/core-kernel`. O teste exige `postgres:17-alpine` descartável e valida módulo **não montado por padrão no Host**, FGA/ENABLED, tenant/workspace, protocolos, equipes e auditoria. O runner define marcador `SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY` apenas no ensaio. **Local: 19 testes PASS**, inclusive a fixture PG17. Não usar essas configu

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

> L9: - [Evolução](EVOLUCAO.md): workpackages e dependências; nenhum item é concluído por estar planejado.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
