---
title: "Q07 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L22: \| `start_pg(name,port,password,version,label?)` \| `scripts/ci/run-suite.sh` \| Inicializa PostgreSQL apenas de teste com label opcional e `trap` de limpeza \|

> L28: Marcador `modules/service-management/package-lock.json`, dependência do `@syndes/core-kernel`. O teste exige `postgres:17-alpine` descartável e valida módulo **não montado por padrão no Host**, FGA/ENABLED, tenant/workspace, protocolos, equipes e auditoria. O runner define marcador `SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY` apenas no ensaio. **Local: 19 testes PASS**, inclusive a fixture PG17. Não usar essas configu

> L42: Q07 **não possui frontend, schema SQL ou migration próprios**. GitHub Actions e Syndes Docs são as interfaces de acompanhamento; o PG17 da suite Serviço é temporário e não substitui tenant real. Não publicar dados sensíveis, tokens, endpoints administrativos nem senhas de ambientes operacionais.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Q07 não mantém API HTTP, schema PostgreSQL, controller, port NestJS nem eventos de negócio**. Seus contratos executáveis são **comandos, JSON de planejamento, YAML de CI e exit codes**, consumidos pelo GitHub Actions.

> L19: O `service-management` utiliza container de teste **descartável** com imagem `postgres:17-alpine`, label `syndes.disposable=funnel-mvp-pg17`, nome e porta fixa de fixture, e marcador `SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY`. O teste `service-funnels-pg17.test.mjs` exige explicitamente esse ambiente e nega casos de uso fora de localhost. O runner controla o lifecycle com `trap` de limpeza.

> L21: **Observação:** o valor da senha do teste é sintético, limitado a runner descartável. Não usar esse DSN, volume ou container para dados reais e não publicar credenciais operacionais.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L33: - Testes de Serviço montam **PostgreSQL 17 descartável**, não acessam tenant real e limpam container via `trap`. Uma suíte de PG17 aprovada só demonstra o cenário do teste e **não** que o plugin de Serviço foi instalado no Host.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
